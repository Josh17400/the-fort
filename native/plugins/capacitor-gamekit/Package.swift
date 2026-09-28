// swift-tools-version: 5.9
import PackageDescription

// The package and library names must match what the Capacitor CLI writes into
// ios/App/CapApp-SPM/Package.swift for this plugin: the npm package name
// "capacitor-gamekit" camel-cased to "CapacitorGamekit".
let package = Package(
    name: "CapacitorGamekit",
    platforms: [.iOS(.v15)],
    products: [
        .library(
            name: "CapacitorGamekit",
            targets: ["GameKitPlugin"])
    ],
    dependencies: [
        .package(url: "https://github.com/ionic-team/capacitor-swift-pm.git", from: "8.0.0")
    ],
    targets: [
        .target(
            name: "GameKitPlugin",
            dependencies: [
                .product(name: "Capacitor", package: "capacitor-swift-pm")
            ],
            path: "ios/Sources/GameKitPlugin")
    ]
)
