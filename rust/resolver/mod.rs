// Type Resolver — converts Declarations into ResolvedTypes map

use std::collections::HashMap;
use crate::parser::Declaration;
use crate::types::{PropertyNode, TypeNode, ResolvedTypes};

/// Map of type name → type parameter names (for generics resolution)
pub type TypeParamNames = HashMap<String, Vec<String>>;

pub struct TypeResolver {
    declarations: Vec<Declaration>,
}

impl TypeResolver {
    pub fn new(declarations: Vec<Declaration>) -> Self {
        Self { declarations }
    }

    pub fn resolve_all(&self) -> ResolvedTypes {
        let mut resolved: ResolvedTypes = HashMap::new();
        for decl in &self.declarations {
            match decl {
                Declaration::Interface { name, properties, extends, type_parameters, type_parameter_names } => {
                    resolved.insert(name.clone(), TypeNode::Interface {
                        name: name.clone(), properties: properties.clone(),
                        extends: extends.clone(), type_parameters: type_parameters.clone(),
                        type_parameter_names: type_parameter_names.clone(),
                    });
                }
                Declaration::TypeAlias { name, type_node, .. } => {
                    resolved.insert(name.clone(), type_node.clone());
                }
                Declaration::Enum { name, members } => {
                    resolved.insert(name.clone(), TypeNode::Enum { name: name.clone(), members: members.clone() });
                }
                Declaration::Class { name, properties, extends, implements } => {
                    resolved.insert(name.clone(), TypeNode::Class {
                        name: name.clone(), properties: properties.clone(),
                        extends: extends.clone(), implements: implements.clone(),
                    });
                }
                Declaration::Import { .. } | Declaration::Export { .. } => {}
            }
        }
        Self::merge_extends(&mut resolved);
        resolved
    }

    pub fn resolve_type(&self, type_name: &str) -> Option<TypeNode> {
        self.resolve_all().get(type_name).cloned()
    }

    /// Build a map of type name → type parameter names for generics resolution
    pub fn resolve_type_params(&self) -> TypeParamNames {
        let mut params = TypeParamNames::new();
        for decl in &self.declarations {
            match decl {
                Declaration::Interface { name, type_parameter_names, .. } => {
                    if !type_parameter_names.is_empty() {
                        params.insert(name.clone(), type_parameter_names.clone());
                    }
                }
                Declaration::TypeAlias { name, type_parameters, .. } => {
                    if !type_parameters.is_empty() {
                        params.insert(name.clone(), type_parameters.clone());
                    }
                }
                Declaration::Class { name, .. } => {
                    // Classes don't store type params in current parser, skip
                }
                _ => {}
            }
        }
        params
    }

    fn merge_extends(resolved: &mut ResolvedTypes) {
        let ext: Vec<(String, Vec<String>)> = resolved.iter().filter_map(|(n, node)| match node {
            TypeNode::Interface { extends, .. } if !extends.is_empty() => Some((n.clone(), extends.clone())),
            TypeNode::Class { extends: Some(p), .. } => Some((n.clone(), vec![p.clone()])),
            _ => None,
        }).collect();

        for (child, parents) in ext {
            let mut inherited: Vec<PropertyNode> = Vec::new();
            for pn in &parents {
                if let Some(pnode) = resolved.get(pn) {
                    match pnode {
                        TypeNode::Interface { properties, .. } | TypeNode::Class { properties, .. } => {
                            inherited.extend(properties.clone());
                        }
                        _ => {}
                    }
                }
            }
            if let Some(cnode) = resolved.get_mut(&child) {
                match cnode {
                    TypeNode::Interface { properties, .. } | TypeNode::Class { properties, .. } => {
                        let own = properties.clone();
                        let mut merged = inherited;
                        for p in own { merged.retain(|x| x.name != p.name); merged.push(p); }
                        *properties = merged;
                    }
                    _ => {}
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::parser::parse_source;

    #[test]
    fn test_resolve_interface() {
        let decls = parse_source("interface User { name: string; age: number; }", "t.ts").unwrap();
        let types = TypeResolver::new(decls).resolve_all();
        assert!(types.contains_key("User"));
    }

    #[test]
    fn test_resolve_extends() {
        let src = "interface Base { id: string; }\ninterface User extends Base { name: string; }";
        let decls = parse_source(src, "t.ts").unwrap();
        let types = TypeResolver::new(decls).resolve_all();
        if let TypeNode::Interface { properties, .. } = &types["User"] {
            assert_eq!(properties.len(), 2);
        } else { panic!("Expected Interface"); }
    }

    #[test]
    fn test_resolve_enum() {
        let decls = parse_source(r#"enum C { R = "R", G = "G" }"#, "t.ts").unwrap();
        let types = TypeResolver::new(decls).resolve_all();
        assert!(types.contains_key("C"));
    }

    #[test]
    fn test_resolve_type_alias() {
        let decls = parse_source(r#"type S = "a" | "b";"#, "t.ts").unwrap();
        let types = TypeResolver::new(decls).resolve_all();
        assert!(types.contains_key("S"));
    }
}
