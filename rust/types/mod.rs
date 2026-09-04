// Internal type system for representing TypeScript types
// This module defines all type kinds and nodes used throughout the library

pub mod options;

use serde::{Deserialize, Serialize};

/// All possible kinds of TypeScript types (31 kinds)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum TypeKind {
    String,
    Number,
    Boolean,
    Null,
    Undefined,
    Void,
    BigInt,
    Symbol,
    Never,
    Any,
    Unknown,
    Literal,
    Array,
    Tuple,
    Object,
    Interface,
    Class,
    Enum,
    EnumMember,
    Union,
    Intersection,
    TypeReference,
    Function,
    Record,
    Partial,
    Required,
    Pick,
    Omit,
    Map,
    Set,
    Date,
    RegExp,
    Promise,
    Optional,
}

/// Represents a literal value (string, number, or boolean)
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(untagged)]
pub enum LiteralValue {
    String(String),
    Number(f64),
    Boolean(bool),
}

impl PartialEq for LiteralValue {
    fn eq(&self, other: &Self) -> bool {
        match (self, other) {
            (LiteralValue::String(a), LiteralValue::String(b)) => a == b,
            (LiteralValue::Number(a), LiteralValue::Number(b)) => a == b,
            (LiteralValue::Boolean(a), LiteralValue::Boolean(b)) => a == b,
            _ => false,
        }
    }
}

/// Represents a property in an interface, class, or object type
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PropertyNode {
    pub name: String,
    #[serde(rename = "type")]
    pub type_node: TypeNode,
    pub optional: bool,
    pub readonly: bool,
}

/// Represents an enum member with name and value
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnumMember {
    pub name: String,
    pub value: LiteralValue,
}

/// Represents a function parameter
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FuncParam {
    pub name: String,
    #[serde(rename = "type")]
    pub type_node: TypeNode,
    pub optional: bool,
}

/// TypeNode represents all possible TypeScript types as a tagged union
/// Each variant contains the specific data needed for that type
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind")]
pub enum TypeNode {
    // Primitive types
    String,
    Number,
    Boolean,
    Null,
    Undefined,
    Void,
    BigInt,
    Symbol,
    Never,
    Any,
    Unknown,
    Date,
    RegExp,

    // Literal type with value
    Literal {
        value: LiteralValue,
    },

    // Array type with element type
    Array {
        #[serde(rename = "elementType")]
        element_type: Box<TypeNode>,
    },

    // Tuple type with fixed elements
    Tuple {
        elements: Vec<TypeNode>,
    },

    // Object type with properties
    Object {
        properties: Vec<PropertyNode>,
    },

    // Interface type
    Interface {
        name: String,
        properties: Vec<PropertyNode>,
        extends: Vec<String>,
        #[serde(rename = "typeParameters")]
        type_parameters: Vec<TypeNode>,
        #[serde(rename = "typeParameterNames")]
        type_parameter_names: Vec<String>,
    },

    // Class type
    Class {
        name: String,
        properties: Vec<PropertyNode>,
        extends: Option<String>,
        implements: Vec<String>,
    },

    // Enum type
    Enum {
        name: String,
        members: Vec<EnumMember>,
    },

    // Union type (A | B | C)
    Union {
        types: Vec<TypeNode>,
    },

    // Intersection type (A & B & C)
    Intersection {
        types: Vec<TypeNode>,
    },

    // Type reference (e.g., User, ApiResponse<T>)
    TypeReference {
        name: String,
        #[serde(rename = "typeArguments")]
        type_arguments: Vec<TypeNode>,
    },

    // Function type
    Function {
        parameters: Vec<FuncParam>,
        #[serde(rename = "returnType")]
        return_type: Box<TypeNode>,
    },

    // Record<K, V> type
    Record {
        #[serde(rename = "keyType")]
        key_type: Box<TypeNode>,
        #[serde(rename = "valueType")]
        value_type: Box<TypeNode>,
    },

    // Partial<T> type
    Partial {
        #[serde(rename = "innerType")]
        inner_type: Box<TypeNode>,
    },

    // Required<T> type
    Required {
        #[serde(rename = "innerType")]
        inner_type: Box<TypeNode>,
    },

    // Pick<T, K> type
    Pick {
        #[serde(rename = "innerType")]
        inner_type: Box<TypeNode>,
        keys: Vec<String>,
    },

    // Omit<T, K> type
    Omit {
        #[serde(rename = "innerType")]
        inner_type: Box<TypeNode>,
        keys: Vec<String>,
    },

    // Map<K, V> type
    Map {
        #[serde(rename = "keyType")]
        key_type: Box<TypeNode>,
        #[serde(rename = "valueType")]
        value_type: Box<TypeNode>,
    },

    // Set<T> type
    Set {
        #[serde(rename = "elementType")]
        element_type: Box<TypeNode>,
    },

    // Promise<T> type
    Promise {
        #[serde(rename = "innerType")]
        inner_type: Box<TypeNode>,
    },

    // Optional<T> type
    Optional {
        #[serde(rename = "innerType")]
        inner_type: Box<TypeNode>,
    },
}

/// Type alias for resolved types map
pub type ResolvedTypes = std::collections::HashMap<String, TypeNode>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_type_kind_serialization() {
        let kind = TypeKind::String;
        let json = serde_json::to_string(&kind).unwrap();
        assert_eq!(json, "\"string\"");
    }

    #[test]
    fn test_literal_value() {
        let lit_str = LiteralValue::String("hello".to_string());
        let lit_num = LiteralValue::Number(42.0);
        let lit_bool = LiteralValue::Boolean(true);

        assert_eq!(lit_str, LiteralValue::String("hello".to_string()));
        assert_eq!(lit_num, LiteralValue::Number(42.0));
        assert_eq!(lit_bool, LiteralValue::Boolean(true));
    }

    #[test]
    fn test_type_node_serialization() {
        let node = TypeNode::String;
        let json = serde_json::to_string(&node).unwrap();
        assert_eq!(json, "{\"kind\":\"String\"}");

        let array = TypeNode::Array {
            element_type: Box::new(TypeNode::Number),
        };
        let json = serde_json::to_string(&array).unwrap();
        assert!(json.contains("\"kind\":\"Array\""));
        assert!(json.contains("\"elementType\""));
    }

    #[test]
    fn test_property_node() {
        let prop = PropertyNode {
            name: "age".to_string(),
            type_node: TypeNode::Number,
            optional: false,
            readonly: true,
        };

        assert_eq!(prop.name, "age");
        assert!(!prop.optional);
        assert!(prop.readonly);
    }
}
