// AST Walker for SWC
// Traverses SWC AST and converts it to our internal type representations

use swc_ecma_ast::*;
use swc_ecma_visit::Visit;

use crate::types::{EnumMember, LiteralValue, PropertyNode, TypeNode};
use super::{Declaration, ImportSpecifier};

/// Visitor that extracts type declarations from SWC AST
pub struct TypeExtractor {
    pub declarations: Vec<Declaration>,
}

impl TypeExtractor {
    pub fn new() -> Self {
        Self {
            declarations: Vec::new(),
        }
    }
}

impl Visit for TypeExtractor {
    // Visit interface declarations
    fn visit_ts_interface_decl(&mut self, decl: &TsInterfaceDecl) {
        let name = decl.id.sym.to_string();

        // Extract extends
        let extends: Vec<String> = decl
            .extends
            .iter()
            .filter_map(|ext| {
                ext.expr.as_ident().map(|id| id.sym.to_string())
            })
            .collect();

        // Extract type parameters
        let (type_parameters, type_parameter_names) = if let Some(type_params) = &decl.type_params {
            let params: Vec<TypeNode> = type_params
                .params
                .iter()
                .map(|p| TypeNode::TypeReference {
                    name: p.name.sym.to_string(),
                    type_arguments: vec![],
                })
                .collect();
            let names: Vec<String> = type_params
                .params
                .iter()
                .map(|p| p.name.sym.to_string())
                .collect();
            (params, names)
        } else {
            (vec![], vec![])
        };

        // Extract properties
        let properties = decl
            .body
            .body
            .iter()
            .filter_map(|member| {
                if let TsTypeElement::TsPropertySignature(prop) = member {
                    convert_property_signature(prop)
                } else {
                    None
                }
            })
            .collect();

        self.declarations.push(Declaration::Interface {
            name,
            properties,
            extends,
            type_parameters,
            type_parameter_names,
        });
    }

    // Visit type alias declarations
    fn visit_ts_type_alias_decl(&mut self, decl: &TsTypeAliasDecl) {
        let name = decl.id.sym.to_string();

        // Extract type parameters
        let type_parameters = if let Some(type_params) = &decl.type_params {
            type_params
                .params
                .iter()
                .map(|p| p.name.sym.to_string())
                .collect()
        } else {
            vec![]
        };

        // Convert type annotation
        let type_node = convert_type_ann(&decl.type_ann);

        self.declarations.push(Declaration::TypeAlias {
            name,
            type_node,
            type_parameters,
        });
    }

    // Visit enum declarations
    fn visit_ts_enum_decl(&mut self, decl: &TsEnumDecl) {
        let name = decl.id.sym.to_string();

        let members = decl
            .members
            .iter()
            .map(|member| {
                let member_name = match &member.id {
                    TsEnumMemberId::Ident(id) => id.sym.to_string(),
                    TsEnumMemberId::Str(s) => s.value.to_string(),
                };

                let value = if let Some(init) = &member.init {
                    convert_expr_to_literal(init)
                } else {
                    // Auto-increment numeric value
                    LiteralValue::Number(self.declarations.len() as f64)
                };

                EnumMember {
                    name: member_name,
                    value,
                }
            })
            .collect();

        self.declarations.push(Declaration::Enum { name, members });
    }

    // Visit class declarations
    fn visit_class_decl(&mut self, decl: &ClassDecl) {
        let name = decl.ident.sym.to_string();

        // Extract extends
        let extends = decl
            .class
            .super_class
            .as_ref()
            .and_then(|expr| expr.as_ident().map(|id| id.sym.to_string()));

        // Extract implements (simplified - just collect type names)
        let implements: Vec<String> = decl
            .class
            .implements
            .iter()
            .filter_map(|impl_| {
                impl_.expr.as_ident().map(|id| id.sym.to_string())
            })
            .collect();

        // Extract properties from class body
        let properties = decl
            .class
            .body
            .iter()
            .filter_map(|member| {
                if let ClassMember::ClassProp(prop) = member {
                    convert_class_property(prop)
                } else {
                    None
                }
            })
            .collect();

        self.declarations.push(Declaration::Class {
            name,
            properties,
            extends,
            implements,
        });
    }

    // Visit import declarations
    fn visit_import_decl(&mut self, decl: &ImportDecl) {
        let source = decl.src.value.to_string();

        let specifiers = decl
            .specifiers
            .iter()
            .filter_map(|spec| {
                match spec {
                    swc_ecma_ast::ImportSpecifier::Named(named) => {
                        let imported = named
                            .imported
                            .as_ref()
                            .map(|i| match i {
                                ModuleExportName::Ident(id) => id.sym.to_string(),
                                ModuleExportName::Str(s) => s.value.to_string(),
                            })
                            .unwrap_or_else(|| named.local.sym.to_string());

                        Some(ImportSpecifier {
                            imported,
                            local: named.local.sym.to_string(),
                        })
                    }
                    swc_ecma_ast::ImportSpecifier::Default(default) => Some(ImportSpecifier {
                        imported: "default".to_string(),
                        local: default.local.sym.to_string(),
                    }),
                    swc_ecma_ast::ImportSpecifier::Namespace(ns) => Some(ImportSpecifier {
                        imported: "*".to_string(),
                        local: ns.local.sym.to_string(),
                    }),
                }
            })
            .collect();

        self.declarations.push(Declaration::Import { source, specifiers });
    }

    // Visit export declarations
    fn visit_named_export(&mut self, decl: &NamedExport) {
        let names = decl
            .specifiers
            .iter()
            .filter_map(|spec| {
                if let ExportSpecifier::Named(named) = spec {
                    match &named.orig {
                        ModuleExportName::Ident(id) => Some(id.sym.to_string()),
                        ModuleExportName::Str(s) => Some(s.value.to_string()),
                    }
                } else {
                    None
                }
            })
            .collect();

        let source = decl.src.as_ref().map(|s| s.value.to_string());

        self.declarations.push(Declaration::Export { names, source });
    }
}

// Helper functions for converting SWC types to our types

fn convert_property_signature(prop: &TsPropertySignature) -> Option<PropertyNode> {
    let name = match &*prop.key {
        Expr::Ident(id) => id.sym.to_string(),
        Expr::Lit(Lit::Str(s)) => s.value.to_string(),
        _ => return None,
    };

    let type_node = prop
        .type_ann
        .as_ref()
        .map(|ann| convert_type_ann(&ann.type_ann))
        .unwrap_or(TypeNode::Any);

    Some(PropertyNode {
        name,
        type_node,
        optional: prop.optional,
        readonly: prop.readonly,
    })
}

fn convert_class_property(prop: &ClassProp) -> Option<PropertyNode> {
    let name = match &prop.key {
        PropName::Ident(id) => id.sym.to_string(),
        PropName::Str(s) => s.value.to_string(),
        _ => return None,
    };

    let type_node = prop
        .type_ann
        .as_ref()
        .map(|ann| convert_type_ann(&ann.type_ann))
        .unwrap_or(TypeNode::Any);

    Some(PropertyNode {
        name,
        type_node,
        optional: prop.is_optional,
        readonly: prop.readonly,
    })
}

fn convert_type_ann(type_ann: &TsType) -> TypeNode {
    match type_ann {
        TsType::TsKeywordType(kw) => match kw.kind {
            TsKeywordTypeKind::TsStringKeyword => TypeNode::String,
            TsKeywordTypeKind::TsNumberKeyword => TypeNode::Number,
            TsKeywordTypeKind::TsBooleanKeyword => TypeNode::Boolean,
            TsKeywordTypeKind::TsNullKeyword => TypeNode::Null,
            TsKeywordTypeKind::TsUndefinedKeyword => TypeNode::Undefined,
            TsKeywordTypeKind::TsVoidKeyword => TypeNode::Void,
            TsKeywordTypeKind::TsBigIntKeyword => TypeNode::BigInt,
            TsKeywordTypeKind::TsSymbolKeyword => TypeNode::Symbol,
            TsKeywordTypeKind::TsNeverKeyword => TypeNode::Never,
            TsKeywordTypeKind::TsAnyKeyword => TypeNode::Any,
            TsKeywordTypeKind::TsUnknownKeyword => TypeNode::Unknown,
            TsKeywordTypeKind::TsObjectKeyword => TypeNode::Object { properties: vec![] },
            TsKeywordTypeKind::TsIntrinsicKeyword => TypeNode::Any,
        },

        TsType::TsTypeRef(type_ref) => convert_type_reference(type_ref),

        TsType::TsArrayType(arr) => TypeNode::Array {
            element_type: Box::new(convert_type_ann(&arr.elem_type)),
        },

        TsType::TsTupleType(tuple) => {
            let elements = tuple
                .elem_types
                .iter()
                .map(|elem| convert_type_ann(&elem.ty))
                .collect();
            TypeNode::Tuple { elements }
        }

        TsType::TsUnionOrIntersectionType(ui) => match ui {
            TsUnionOrIntersectionType::TsUnionType(union) => {
                let types = union.types.iter().map(|t| convert_type_ann(t)).collect();
                TypeNode::Union { types }
            }
            TsUnionOrIntersectionType::TsIntersectionType(intersection) => {
                let types = intersection.types.iter().map(|t| convert_type_ann(t)).collect();
                TypeNode::Intersection { types }
            }
        },

        TsType::TsLitType(lit) => {
            let value = match &lit.lit {
                TsLit::Str(s) => LiteralValue::String(s.value.to_string()),
                TsLit::Number(n) => LiteralValue::Number(n.value),
                TsLit::Bool(b) => LiteralValue::Boolean(b.value),
                TsLit::BigInt(bi) => {
                    LiteralValue::Number(bi.value.to_string().parse().unwrap_or(0.0))
                }
                _ => LiteralValue::String("".to_string()),
            };
            TypeNode::Literal { value }
        }

        TsType::TsTypeLit(lit) => {
            let properties = lit
                .members
                .iter()
                .filter_map(|member| {
                    if let TsTypeElement::TsPropertySignature(prop) = member {
                        convert_property_signature(prop)
                    } else {
                        None
                    }
                })
                .collect();
            TypeNode::Object { properties }
        }

        TsType::TsTypeQuery(_) => TypeNode::Any, // typeof queries
        TsType::TsThisType(_) => TypeNode::Any,
        TsType::TsFnOrConstructorType(_) => TypeNode::Function {
            parameters: vec![],
            return_type: Box::new(TypeNode::Any),
        },
        TsType::TsMappedType(_) => TypeNode::Any, // Mapped types
        TsType::TsConditionalType(_) => TypeNode::Any,
        TsType::TsInferType(_) => TypeNode::Any,
        TsType::TsParenthesizedType(paren) => convert_type_ann(&paren.type_ann),
        TsType::TsOptionalType(opt) => TypeNode::Optional {
            inner_type: Box::new(convert_type_ann(&opt.type_ann)),
        },
        TsType::TsRestType(rest) => TypeNode::Array {
            element_type: Box::new(convert_type_ann(&rest.type_ann)),
        },
        TsType::TsTypeOperator(op) => convert_type_ann(&op.type_ann),
        TsType::TsIndexedAccessType(_) => TypeNode::Any,
        TsType::TsImportType(_) => TypeNode::Any,
        TsType::TsTypePredicate(_) => TypeNode::Boolean, // Type predicates like "x is string"
    }
}

fn convert_type_reference(type_ref: &TsTypeRef) -> TypeNode {
    let name = match &type_ref.type_name {
        TsEntityName::Ident(id) => id.sym.to_string(),
        TsEntityName::TsQualifiedName(qn) => {
            // Handle qualified names like A.B.C
            let mut parts = vec![qn.right.sym.to_string()];
            let mut current: &TsEntityName = &qn.left;
            loop {
                match current {
                    TsEntityName::Ident(id) => {
                        parts.push(id.sym.to_string());
                        break;
                    }
                    TsEntityName::TsQualifiedName(qn) => {
                        parts.push(qn.right.sym.to_string());
                        current = &qn.left;
                    }
                }
            }
            parts.reverse();
            parts.join(".")
        }
    };

    // Extract type arguments
    let type_arguments = if let Some(type_params) = &type_ref.type_params {
        type_params
            .params
            .iter()
            .map(|p| convert_type_ann(p))
            .collect()
    } else {
        vec![]
    };

    // Check for utility types
    match name.as_str() {
        "Array" | "ReadonlyArray" => {
            let element_type = type_arguments
                .into_iter()
                .next()
                .unwrap_or(TypeNode::Any);
            TypeNode::Array {
                element_type: Box::new(element_type),
            }
        }
        "Record" if type_arguments.len() == 2 => {
            let mut args = type_arguments.into_iter();
            TypeNode::Record {
                key_type: Box::new(args.next().unwrap()),
                value_type: Box::new(args.next().unwrap()),
            }
        }
        "Partial" if type_arguments.len() == 1 => TypeNode::Partial {
            inner_type: Box::new(type_arguments.into_iter().next().unwrap()),
        },
        "Required" if type_arguments.len() == 1 => TypeNode::Required {
            inner_type: Box::new(type_arguments.into_iter().next().unwrap()),
        },
        "Pick" if type_arguments.len() == 2 => {
            let mut args = type_arguments.into_iter();
            let inner_type = args.next().unwrap();
            let keys_type = args.next().unwrap();
            // Extract keys from union type
            let keys = if let TypeNode::Union { types } = keys_type {
                types
                    .into_iter()
                    .filter_map(|t| {
                        if let TypeNode::Literal {
                            value: LiteralValue::String(s),
                        } = t
                        {
                            Some(s)
                        } else {
                            None
                        }
                    })
                    .collect()
            } else {
                vec![]
            };
            TypeNode::Pick {
                inner_type: Box::new(inner_type),
                keys,
            }
        }
        "Omit" if type_arguments.len() == 2 => {
            let mut args = type_arguments.into_iter();
            let inner_type = args.next().unwrap();
            let keys_type = args.next().unwrap();
            // Extract keys from union type
            let keys = if let TypeNode::Union { types } = keys_type {
                types
                    .into_iter()
                    .filter_map(|t| {
                        if let TypeNode::Literal {
                            value: LiteralValue::String(s),
                        } = t
                        {
                            Some(s)
                        } else {
                            None
                        }
                    })
                    .collect()
            } else {
                vec![]
            };
            TypeNode::Omit {
                inner_type: Box::new(inner_type),
                keys,
            }
        }
        "Map" if type_arguments.len() == 2 => {
            let mut args = type_arguments.into_iter();
            TypeNode::Map {
                key_type: Box::new(args.next().unwrap()),
                value_type: Box::new(args.next().unwrap()),
            }
        }
        "Set" if type_arguments.len() == 1 => TypeNode::Set {
            element_type: Box::new(type_arguments.into_iter().next().unwrap()),
        },
        "Date" => TypeNode::Date,
        "RegExp" => TypeNode::RegExp,
        "Promise" if type_arguments.len() == 1 => TypeNode::Promise {
            inner_type: Box::new(type_arguments.into_iter().next().unwrap()),
        },
        _ => TypeNode::TypeReference {
            name,
            type_arguments,
        },
    }
}

fn convert_expr_to_literal(expr: &Expr) -> LiteralValue {
    match expr {
        Expr::Lit(lit) => match lit {
            Lit::Str(s) => LiteralValue::String(s.value.to_string()),
            Lit::Num(n) => LiteralValue::Number(n.value),
            Lit::Bool(b) => LiteralValue::Boolean(b.value),
            _ => LiteralValue::String("".to_string()),
        },
        Expr::Unary(unary) if unary.op == UnaryOp::Minus => {
            if let Expr::Lit(Lit::Num(n)) = &*unary.arg {
                LiteralValue::Number(-n.value)
            } else {
                LiteralValue::Number(0.0)
            }
        }
        _ => LiteralValue::String("".to_string()),
    }
}
