// SWC-based TypeScript parser
// Uses SWC's fast parser to parse TypeScript and extract type information

use swc_common::{
    sync::Lrc, FileName, SourceMap,
};
use swc_ecma_ast::*;
use swc_ecma_parser::{lexer::Lexer, Parser, StringInput, Syntax, TsSyntax};
use swc_ecma_visit::VisitWith;

use super::{Declaration, ast_walker::TypeExtractor};

/// Parse TypeScript source code using SWC
pub fn parse_typescript(source: &str, file_path: &str) -> Result<Vec<Declaration>, String> {
    // Create source map
    let cm: Lrc<SourceMap> = Default::default();
    let fm = cm.new_source_file(
        Lrc::new(FileName::Real(file_path.into())),
        source.to_string(),
    );

    // Configure TypeScript parser
    let syntax = Syntax::Typescript(TsSyntax {
        tsx: file_path.ends_with(".tsx"),
        decorators: true,
        ..Default::default()
    });

    // Create lexer
    let lexer = Lexer::new(
        syntax,
        EsVersion::latest(),
        StringInput::from(&*fm),
        None,
    );

    // Create parser
    let mut parser = Parser::new_from(lexer);

    // Parse module
    let module = parser
        .parse_module()
        .map_err(|e| format!("Parse error: {:?}", e))?;

    // Extract declarations using visitor pattern
    let mut extractor = TypeExtractor::new();
    module.visit_with(&mut extractor);

    Ok(extractor.declarations)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_empty_file() {
        let result = parse_typescript("", "empty.ts");
        assert!(result.is_ok());
        assert_eq!(result.unwrap().len(), 0);
    }

    #[test]
    fn test_parse_syntax_error() {
        let source = "interface { invalid syntax }";
        let result = parse_typescript(source, "invalid.ts");
        assert!(result.is_err());
    }
}
