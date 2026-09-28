import GameKit
import UIKit

/// The GameKit half of the plugin: no Capacitor types in sight. Every result
/// comes back on the main queue so the bridge layer can settle plugin calls and
/// touch UIKit without re-dispatching.
enum GameCenter {

    /// True once GameKit's authenticate handler has reported a terminal state
    /// (signed in, or the player declined / it failed). Until then a sign-in
    /// call has to wait; afterwards the answer is already known.
    private(set) static var didReportState = false
    private static var handlerInstalled = false

    static var isAuthenticated: Bool { GKLocalPlayer.local.isAuthenticated }

    /// `{ playerId, displayName }` while signed in, `{ playerId: null }`
    /// otherwise - the shape `Shell.gc` caches as the current player.
    static func playerPayload() -> [String: Any] {
        let player = GKLocalPlayer.local
        guard player.isAuthenticated else { return ["playerId": NSNull()] }
        return ["playerId": player.gamePlayerID, "displayName": player.displayName]
    }

    /// Starts Game Center authentication. Call on the main queue.
    ///
    /// The handler is assigned exactly once per process: assigning it again
    /// restarts authentication, which is the classic way to loop the sign-in
    /// sheet. GameKit re-invokes it on every later auth change (sign-out,
    /// account switch), so `onState` is a live feed, not a one-shot completion.
    static func startAuthentication(present: @escaping (UIViewController) -> Void,
                                    onState: @escaping (Error?) -> Void) {
        guard !handlerInstalled else { return }
        handlerInstalled = true
        GKLocalPlayer.local.authenticateHandler = { viewController, error in
            DispatchQueue.main.async {
                if let viewController = viewController {
                    // GameKit wants its sign-in sheet on screen and calls this
                    // handler again once the player is done with it.
                    present(viewController)
                    return
                }
                GameCenter.didReportState = true
                onState(error)
            }
        }
    }

    static func submitScore(_ score: Int, leaderboardID: String, completion: @escaping (Error?) -> Void) {
        GKLeaderboard.submitScore(score,
                                  context: 0,
                                  player: GKLocalPlayer.local,
                                  leaderboardIDs: [leaderboardID]) { error in
            DispatchQueue.main.async { completion(error) }
        }
    }

    static func reportAchievement(id: String, percent: Double, completion: @escaping (Error?) -> Void) {
        let achievement = GKAchievement(identifier: id)
        achievement.percentComplete = min(max(percent, 0), 100)
        achievement.showsCompletionBanner = true
        GKAchievement.report([achievement]) { error in
            DispatchQueue.main.async { completion(error) }
        }
    }
}
