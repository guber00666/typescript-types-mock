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
pub fn parse_file(file_path: &str) -> Result<Vec<Declaration>, String> {
    let mut visited: Vec<String> = Vec::new();
    parse_file_recursive(file_path, &mut visited)
}

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

    for (import_source, _specifiers) in &imports {
        // Only follow relative imports (skip node_modules / bare specifiers)
        if !import_source.starts_with('.') {
            continue;
        }

        let resolved_path = resolve_import_path(base_dir, import_source);
        if let Some(resolved) = resolved_path {
            match parse_file_recursive(&resolved, visited) {
                Ok(mut imported_decls) => {
                    declarations.append(&mut imported_decls);
                }
                Err(_) => {
                    // Silently skip unresolvable imports (e.g. barrel files, .js extensions)
                }
            }
        }
    }

    Ok(declarations)
}

/// Resolve an import specifier to a file path, trying common TypeScript extensions.
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
