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

    // Collect imports and resolve them
    let imports: Vec<(String, Vec<ImportSpecifier>)> = declarations.iter().filter_map(|d| {
        if let Declaration::Import { source, specifiers } = d {
            Some((source.clone(), specifiers.clone()))
        } else {
            None
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
            resolve_tsconfig_path(tsconfig_dir, aliases, import_source)
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
        // Try as directory with index file
        joined.join("index.ts"),
        joined.join("index.tsx"),
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
}
