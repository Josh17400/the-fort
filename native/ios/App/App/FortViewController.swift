import UIKit
import Capacitor

/// Capacitor's bridge view controller plus what a full-screen action game needs that
/// capacitor.config.json cannot express. (Bounce, scrolling, pinch zoom and the dark web view
/// background are Capacitor settings in capacitor.config.json; the status bar is hidden by
/// UIStatusBarHidden in Info.plist.) Main.storyboard instantiates this class.
/// prefersHomeIndicatorAutoHidden cannot be overridden here: CAPBridgeViewController declares
/// it public, not open, so Swift rejects an override from this module.
class FortViewController: CAPBridgeViewController {

    /// A swipe that starts at a screen edge goes to the game first (aiming along the bottom edge,
    /// dragging from the top); the system gesture takes a second swipe, so a battle is never
    /// dropped into the app switcher by accident.
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge {
        return .all
    }
}
