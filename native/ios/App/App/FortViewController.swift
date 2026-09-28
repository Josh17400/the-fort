import UIKit
import Capacitor

/// Capacitor's bridge view controller plus the two things a full-screen action game needs that
/// capacitor.config.json cannot express. (Bounce, scrolling, pinch zoom and the dark web view
/// background are Capacitor settings in capacitor.config.json; the status bar is hidden by
/// UIStatusBarHidden in Info.plist.) Main.storyboard instantiates this class.
class FortViewController: CAPBridgeViewController {

    /// The home indicator fades out after a few seconds without a touch.
    override var prefersHomeIndicatorAutoHidden: Bool {
        return true
    }

    /// A swipe that starts at a screen edge goes to the game first (aiming along the bottom edge,
    /// dragging from the top); the system gesture takes a second swipe, so a battle is never
    /// dropped into the app switcher by accident.
    override var preferredScreenEdgesDeferringSystemGestures: UIRectEdge {
        return .all
    }
}
