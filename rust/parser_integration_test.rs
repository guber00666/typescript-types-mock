// Integration test for parsing real TypeScript files

#[cfg(test)]
mod integration_tests {
    use crate::parser::parse_file;

    #[test]
    fn test_parse_sample_types() {
        let file_path = "testdata/sample-types.ts";

        // Skip test if file doesn't exist
        if !std::path::Path::new(file_path).exists() {
            println!("Skipping test: {} not found", file_path);
            return;
        }

        let declarations = parse_file(file_path).unwrap();

        println!("Parsed {} declarations from {}", declarations.len(), file_path);

        // Should have multiple declarations
        assert!(declarations.len() > 5, "Expected at least 5 declarations");

        // Count declaration types
        let mut interface_count = 0;
        let mut type_alias_count = 0;
        let mut enum_count = 0;

        for decl in &declarations {
            match decl {
                crate::parser::Declaration::Interface { name, properties, .. } => {
                    interface_count += 1;
                    println!("Interface: {} ({} properties)", name, properties.len());
                }
                crate::parser::Declaration::TypeAlias { name, .. } => {
                    type_alias_count += 1;
                    println!("TypeAlias: {}", name);
                }
                crate::parser::Declaration::Enum { name, members } => {
                    enum_count += 1;
                    println!("Enum: {} ({} members)", name, members.len());
                }
                crate::parser::Declaration::Class { name, .. } => {
                    println!("Class: {}", name);
                }
                crate::parser::Declaration::Import { source, specifiers } => {
                    println!("Import: {} ({} specifiers)", source, specifiers.len());
                }
                crate::parser::Declaration::Export { names, .. } => {
                    println!("Export: {} names", names.len());
                }
            }
        }

        // Verify we found expected declaration types
        assert!(interface_count > 0, "Expected at least one interface");
        assert!(type_alias_count > 0, "Expected at least one type alias");
        assert!(enum_count > 0, "Expected at least one enum");
    }
}
