// swift-tools-version: 5.9
import PackageDescription

// Golden runner for the parity harness (M4). Runs RAMLParserKit (Swift) over a
// fixture and writes its ParsedSpec as JSON — the golden the TypeScript output
// is projected against. macOS-only, local use (no CI).
let package = Package(
    name: "swift-golden",
    platforms: [.macOS(.v13)],
    dependencies: [
        .package(url: "https://github.com/dickiedyce/RAMLParserKit", from: "1.1.0"),
    ],
    targets: [
        .executableTarget(
            name: "swift-golden",
            dependencies: [
                .product(name: "RAMLParserKit", package: "RAMLParserKit"),
            ],
            path: "Sources"
        ),
    ]
)
