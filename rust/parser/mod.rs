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

/// Parse a TypeScript file and extract all declarations
pub fn parse_file(file_path: &str) -> Result<Vec<Declaration>, String> {
    let source = std::fs::read_to_string(file_path)
        .map_err(|e| format!("Failed to read file {}: {}", file_path, e))?;

    swc_parser::parse_typescript(&source, file_path)
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
