import Foundation
import RAMLParserKit

// Parses one root spec with RAMLParserKit and writes its output as JSON.
// Usage: swift-golden <root-spec-file> <output.json>
//
// Output goes to a file (not stdout) because RAMLParserKit logs warnings via
// print(). The wrapper re-serialises ParsedSpec's components; their Codable
// conformances already exclude the UUID `id` fields.

struct GoldenSpec: Encodable {
    let apiInfo: APIInfo
    let endpoints: [Endpoint]
    let requirements: [Requirement]
}

guard CommandLine.arguments.count >= 3 else {
    FileHandle.standardError.write(
        "usage: swift-golden <root-spec-file> <output.json>\n".data(using: .utf8)!)
    exit(2)
}

let input = URL(fileURLWithPath: CommandLine.arguments[1])
let output = URL(fileURLWithPath: CommandLine.arguments[2])

do {
    let spec = try RAMLParser(fileURL: input).parse()
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
    let data = try encoder.encode(
        GoldenSpec(
            apiInfo: spec.apiInfo,
            endpoints: spec.endpoints,
            requirements: spec.requirements))
    try data.write(to: output)
    FileHandle.standardError.write("wrote \(output.path)\n".data(using: .utf8)!)
} catch {
    FileHandle.standardError.write("error: \(error)\n".data(using: .utf8)!)
    exit(1)
}
