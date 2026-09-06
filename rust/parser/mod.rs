// TypeScript parser module
// Parses .ts/.tsx files and extracts type declarations

pub mod swc_parser;
pub mod ast_walker;

use crate::types::TypeNode;

/// Represents a parsed declaration from TypeScript source
#[derive(Debug, Clone)]
pub enum Declaration {
    Interface {
        name: String,
        properties: Vec<crate::types::PropertyNode>,
        extends: Vec<String>,
        type_parameters: Vec<TypeNode>,
        type_parameter_names: Vec<String>,
    },
    TypeAlias {
        name: String,
        type_node: TypeNode,
        type_parameters: Vec<String>,
    },
    Enum {
        name: String,
        members: Vec<crate::types::EnumMember>,
    },
    Class {
        name: String,
        properties: Vec<crate::types::PropertyNode>,
        extends: Option<String>,
        implements: Vec<String>,
    },
    Import {
        source: String,
        specifiers: Vec<ImportSpecifier>,
    },
    Export {
        names: Vec<String>,
        source: Option<String>,
    },
}

/// Import specifier
#[derive(Debug, Clone)]
pub struct ImportSpecifier {
    pub imported: String,
    pub local: String,
}

/// Parse a TypeScript file and extract all declarations.
/// Follows relative imports recursively to resolve cross-file type references.
#[cfg(not(target_arch = "wasm32"))]
pub fn parse_file(file_path: &str) -> Result<Vec<Declaration>, String> {
    let mut visited: Vec<String> = Vec::new();
    parse_file_recursive(file_path, &mut visited)
}

#[cfg(not(target_arch = "wasm32"))]
fn parse_file_recursive(file_path: &str, visited: &mut Vec<String>) -> Result<Vec<Declaration>, String> {
    // Normalize path to avoid revisiting the same file
    let canonical = std::fs::canonicalize(file_path)
        .map(|p| p.to_string_lossy().to_string())
        .unwrap_or_else(|_| file_path.to_string());

    if visited.contains(&canonical) {
        return Ok(Vec::new()); // Already parsed — skip (handles circular imports)
    }
    visited.push(canonical);

    let source = std::fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read file {}: {}", file_path, e))?;

    let mut declarations = swc_parser::parse_typescript(&source, file_path)?;

    // Collect imports and re-exports and resolve them
    let imports: Vec<(String, Vec<ImportSpecifier>)> = declarations.iter().filter_map(|d| {
        match d {
            Declaration::Import { source, specifiers } => {
                Some((source.clone(), specifiers.clone()))
            }
            Declaration::Export { source: Some(src), .. } => {
                // Re-exports: export { X } from "./module"
                Some((src.clone(), Vec::new()))
            }
            _ => None,
        }
    }).collect();

    let base_dir = std::path::Path::new(file_path).parent()
        .unwrap_or_else(|| std::path::Path::new("."));

    // Lazy-load tsconfig paths (only when a bare specifier is encountered)
    let mut tsconfig_cache: Option<(std::path::PathBuf, Vec<(String, String)>)> = None;

    for (import_source, _specifiers) in &imports {
        let resolved_path = if import_source.starts_with('.') {
            resolve_import_path(base_dir, import_source)
        } else {
            // Try tsconfig paths for bare module specifiers
            let (tsconfig_dir, aliases) = match &tsconfig_cache {
                Some(cached) => cached,
                None => {
                    let info = load_tsconfig_paths(file_path);
                    tsconfig_cache = Some(info);
                    tsconfig_cache.as_ref().unwrap()
                }
            };
            let tsconfig_result = resolve_tsconfig_path(tsconfig_dir, aliases, import_source);
            // Fallback: try resolving from node_modules (npm packages)
            tsconfig_result.or_else(|| resolve_node_module_path(base_dir, import_source))
        };

        if let Some(resolved) = resolved_path {
            match parse_file_recursive(&resolved, visited) {
                Ok(mut imported_decls) => {
                    declarations.append(&mut imported_decls);
                }
                Err(_) => {} // Silently skip unresolvable imports
            }
        }
    }

    Ok(declarations)
}

/// Resolve an import specifier to a file path, trying common TypeScript extensions.
#[cfg(not(target_arch = "wasm32"))]
fn resolve_import_path(base_dir: &std::path::Path, import_source: &str) -> Option<String> {
    let joined = base_dir.join(import_source);
    let candidates = [
        joined.with_extension("ts"),
        joined.with_extension("tsx"),
        joined.with_extension("d.ts"),
        joined.with_extension("d.tsx"),
        // Try as directory with index file
        joined.join("index.ts"),
        joined.join("index.tsx"),
        joined.join("index.d.ts"),
        joined.join("index.d.tsx"),
        // Already has extension
        joined.clone(),
    ];

    for candidate in &candidates {
        if candidate.exists() {
            return Some(candidate.to_string_lossy().to_string());
        }
    }
    None
}

/// Load tsconfig.json paths by walking up from the file's directory.
/// Returns (tsconfig_dir, aliases as (prefix, replacement) pairs).
#[cfg(not(target_arch = "wasm32"))]
fn load_tsconfig_paths(file_path: &str) -> (std::path::PathBuf, Vec<(String, String)>) {
    let start_dir = std::path::Path::new(file_path).parent()
        .unwrap_or_else(|| std::path::Path::new("."));
    let start_dir = std::fs::canonicalize(start_dir).unwrap_or_else(|_| start_dir.to_path_buf());

    let mut dir = start_dir.as_path();
    loop {
        let tsconfig = dir.join("tsconfig.json");
        if tsconfig.exists() {
            if let Ok(content) = std::fs::read_to_string(&tsconfig) {
                if let Ok(json) = serde_json::from_str::<serde_json::Value>(&content) {
                    let base_url = json["compilerOptions"]["baseUrl"].as_str().unwrap_or(".");
                    let base_dir = dir.join(base_url);
                    let mut aliases = Vec::new();
                    if let Some(paths) = json["compilerOptions"]["paths"].as_object() {
                        for (pattern, targets) in paths {
                            if let Some(arr) = targets.as_array() {
                                if let Some(first) = arr.first().and_then(|v| v.as_str()) {
                                    if let Some(prefix) = pattern.strip_suffix("/*") {
                                        let replacement = first.trim_end_matches("/*");
                                        aliases.push((
                                            format!("{}/", prefix),
                                            base_dir.join(replacement).to_string_lossy().to_string(),
                                        ));
                                    } else {
                                        aliases.push((
                                            pattern.clone(),
                                            base_dir.join(first).to_string_lossy().to_string(),
                                        ));
                                    }
                                }
                            }
                        }
                    }
                    return (dir.to_path_buf(), aliases);
                }
            }
            return (dir.to_path_buf(), Vec::new());
        }
        match dir.parent() {
            Some(parent) => dir = parent,
            None => break,
        }
    }
    (start_dir, Vec::new())
}

/// Resolve a bare module specifier by looking it up in `node_modules`.
///
/// For a specifier like `"axios"` or `"@types/node"`:
/// 1. Walk up the directory tree from `base_dir` looking for `node_modules/<pkg>`
/// 2. Read `package.json` to find the entry `.d.ts` file (`types`, `typings`, or `main`)
/// 3. If a subpath is given (e.g. `"axios/lib/types"`), resolve it within the package
#[cfg(not(target_arch = "wasm32"))]
fn resolve_node_module_path(base_dir: &std::path::Path, import_source: &str) -> Option<String> {
    // Split specifier into package name + optional subpath
    let (pkg_name, subpath) = if import_source.starts_with('@') {
        // Scoped package: "@scope/name" or "@scope/name/sub/path"
        let mut parts = import_source.splitn(3, '/');
        let scope = parts.next()?; // "@scope"
        let name = parts.next()?; // "name"
        let pkg = format!("{}/{}", scope, name);
        let sub = parts.next().unwrap_or("");
        (pkg, sub)
    } else {
        // Regular package: "axios" or "axios/lib/types"
        let mut parts = import_source.splitn(2, '/');
        let pkg = parts.next()?.to_string();
        let sub = parts.next().unwrap_or("");
        (pkg, sub)
    };

    // Walk up from base_dir looking for node_modules/<pkg_name>
    let mut dir = Some(base_dir);
    while let Some(current) = dir {
        let pkg_dir = current.join("node_modules").join(&pkg_name);
        if pkg_dir.is_dir() {
            // If subpath given, resolve within the package
            if !subpath.is_empty() {
                let sub_resolved = pkg_dir.join(subpath);
                let candidates = [
                    sub_resolved.with_extension("d.ts"),
                    sub_resolved.with_extension("d.tsx"),
                    sub_resolved.join("index.d.ts"),
                    sub_resolved.join("index.d.tsx"),
                ];
                for candidate in &candidates {
                    if candidate.exists() {
                        return Some(candidate.to_string_lossy().to_string());
                    }
                }
                // Also try without adding extension (file might already have .d.ts)
                if sub_resolved.exists() {
                    return Some(sub_resolved.to_string_lossy().to_string());
                }
                continue;
            }

            // Read package.json to find types entry
            let pkg_json_path = pkg_dir.join("package.json");
            if let Ok(pkg_json_str) = std::fs::read_to_string(&pkg_json_path) {
                if let Ok(pkg_json) = serde_json::from_str::<serde_json::Value>(&pkg_json_str) {
                    // 1. Try "types" or "typings" field
                    let types_field = pkg_json.get("types")
                        .or_else(|| pkg_json.get("typings"))
                        .and_then(|v| v.as_str());

                    if let Some(types_path) = types_field {
                        let types_file = pkg_dir.join(types_path);
                        if types_file.exists() {
                            return Some(types_file.to_string_lossy().to_string());
                        }
                    }

                    // 2. Try "exports" -> "." -> "types" field (modern packages)
                    let exports_types = pkg_json.get("exports")
                        .and_then(|e| e.get("."))
                        .and_then(|e| e.get("types"))
                        .and_then(|v| v.as_str());

                    if let Some(types_path) = exports_types {
                        let types_file = pkg_dir.join(types_path);
                        if types_file.exists() {
                            return Some(types_file.to_string_lossy().to_string());
                        }
                    }

                    // 3. Try "main" field, replacing .js with .d.ts
                    let main_field = pkg_json.get("main")
                        .and_then(|v| v.as_str());

                    if let Some(main_path) = main_field {
                        let main_file = pkg_dir.join(main_path);
                        let dts_file = main_file.with_extension("d.ts");
                        if dts_file.exists() {
                            return Some(dts_file.to_string_lossy().to_string());
                        }
                    }
                }
            }

            // 4. Fallback: try index.d.ts
            let index_dts = pkg_dir.join("index.d.ts");
            if index_dts.exists() {
                return Some(index_dts.to_string_lossy().to_string());
            }
        }
        dir = current.parent();
    }
    None
}

/// Resolve a bare module specifier using tsconfig paths aliases.
#[cfg(not(target_arch = "wasm32"))]
fn resolve_tsconfig_path(
    _tsconfig_dir: &std::path::Path,
    aliases: &[(String, String)],
    import_source: &str,
) -> Option<String> {
    for (pattern_prefix, replacement_prefix) in aliases {
        if let Some(rest) = import_source.strip_prefix(pattern_prefix.as_str()) {
            let resolved = format!("{}/{}", replacement_prefix, rest);
            let resolved_path = std::path::Path::new(&resolved);
            let candidates = [
                resolved_path.with_extension("ts"),
                resolved_path.with_extension("tsx"),
                resolved_path.join("index.ts"),
                resolved_path.join("index.tsx"),
            ];
            for candidate in &candidates {
                if candidate.exists() {
                    return Some(candidate.to_string_lossy().to_string());
                }
            }
        } else if import_source == pattern_prefix.trim_end_matches('/') {
            let resolved_path = std::path::Path::new(replacement_prefix);
            let candidates = [
                resolved_path.with_extension("ts"),
                resolved_path.with_extension("tsx"),
                resolved_path.join("index.ts"),
                resolved_path.join("index.tsx"),
            ];
            for candidate in &candidates {
                if candidate.exists() {
                    return Some(candidate.to_string_lossy().to_string());
                }
            }
        }
    }
    None
}

/// Parse TypeScript source code directly
pub fn parse_source(source: &str, file_path: &str) -> Result<Vec<Declaration>, String> {
    swc_parser::parse_typescript(source, file_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_simple_interface() {
        let source = r#"
interface User {
    name: string;
    age: number;
    email?: string;
}
"#;
        let declarations = parse_source(source, "test.ts").unwrap();
        assert_eq!(declarations.len(), 1);

        match &declarations[0] {
            Declaration::Interface { name, properties, .. } => {
                assert_eq!(name, "User");
                assert_eq!(properties.len(), 3);
            }
            _ => panic!("Expected Interface declaration"),
        }
    }

    #[test]
    fn test_parse_enum() {
        let source = r#"
enum Color {
    Red = "red",
    Green = "green",
    Blue = "blue"
}
"#;
        let declarations = parse_source(source, "test.ts").unwrap();
        assert_eq!(declarations.len(), 1);

        match &declarations[0] {
            Declaration::Enum { name, members } => {
                assert_eq!(name, "Color");
                assert_eq!(members.len(), 3);
            }
            _ => panic!("Expected Enum declaration"),
        }
    }

    #[test]
    fn test_parse_type_alias() {
        let source = r#"
type StringOrNumber = string | number;
"#;
        let declarations = parse_source(source, "test.ts").unwrap();
        assert_eq!(declarations.len(), 1);

        match &declarations[0] {
            Declaration::TypeAlias { name, type_node, .. } => {
                assert_eq!(name, "StringOrNumber");
                match type_node {
                    TypeNode::Union { types } => {
                        assert_eq!(types.len(), 2);
                    }
                    _ => panic!("Expected Union type"),
                }
            }
            _ => panic!("Expected TypeAlias declaration"),
        }
    }

    #[test]
    #[cfg(not(target_arch = "wasm32"))]
    fn test_parse_file_with_node_modules() {
        let fixture_path = "tests/fixtures/node-modules-test/consumer.ts";
        let declarations = parse_file(fixture_path).unwrap();
        
        // Should have parsed MyData interface from consumer.ts
        let my_data = declarations.iter().find(|d| {
            if let Declaration::Interface { name, .. } = d {
                name == "MyData"
            } else {
                false
            }
        });
        assert!(my_data.is_some(), "MyData interface should be parsed");

        // Should have parsed ExternalResponse from node_modules/fake-package
        let external_response = declarations.iter().find(|d| {
            if let Declaration::Interface { name, .. } = d {
                name == "ExternalResponse"
            } else {
                false
            }
        });
        assert!(external_response.is_some(), "ExternalResponse from node_modules should be parsed");

        // Should have parsed Status type from node_modules/fake-package
        let status = declarations.iter().find(|d| {
            if let Declaration::TypeAlias { name, .. } = d {
                name == "Status"
            } else {
                false
            }
        });
        assert!(status.is_some(), "Status type from node_modules should be parsed");
    }
}
