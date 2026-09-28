import Capacitor
import Foundation
import GameKit
import UIKit

/// Project-owned GameKit bridge behind `window.Shell.gc` (native/shell.js):
/// sign-in, leaderboard scores, achievements and the two native Game Center
/// screens. iOS only - there is no Android source, so the shell keeps its
/// degrade path everywhere else.
///
/// Every method settles its call exactly once. UIKit and the GameKit
/// authenticate handler are only ever touched on the main queue.
@objc(GameKitPlugin)
public class GameKitPlugin: CAPPlugin, CAPBridgedPlugin, GKGameCenterControllerDelegate {
    public let identifier = "GameKitPlugin"
    public let jsName = "GameKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "signIn", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "submitScore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showLeaderboard", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "unlockAchievement", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "showAchievements", returnType: CAPPluginReturnPromise)
    ]

    private static let notAuthenticated = "NOT_AUTHENTICATED"
    private static let invalidArgument = "INVALID_ARGUMENT"
    private static let gameKitFailed = "GAMEKIT_ERROR"
    private static let noViewController = "NO_VIEW_CONTROLLER"

    /// Sign-in calls waiting on the first authenticate-handler callback.
    /// Only touched on the main queue.
    private var pendingSignIns: [CAPPluginCall] = []

    // MARK: - sign in

    @objc func signIn(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            if GameCenter.isAuthenticated {
                call.resolve(GameCenter.playerPayload())
                return
            }
            if GameCenter.didReportState {
                // GameKit already answered this launch: the player is signed
                // out or declined. Re-arming it would re-run the sheet.
                call.reject("Not signed in to Game Center", GameKitPlugin.notAuthenticated)
                return
            }
            self.pendingSignIns.append(call)
            GameCenter.startAuthentication(
                present: { [weak self] viewController in self?.presentSignIn(viewController) },
                onState: { [weak self] error in self?.authenticationChanged(error) }
            )
        }
    }

    private func presentSignIn(_ viewController: UIViewController) {
        guard !present(viewController) else { return }
        // Nothing on screen to present from, and GameKit will not call its
        // handler again for this attempt - settle now rather than hang.
        drainSignIns { $0.reject("No view controller to present Game Center sign-in from",
                                 GameKitPlugin.notAuthenticated) }
    }

    private func authenticationChanged(_ error: Error?) {
        let payload = GameCenter.playerPayload()
        if GameCenter.isAuthenticated {
            drainSignIns { $0.resolve(payload) }
        } else {
            let message = error?.localizedDescription ?? "Game Center sign-in was not completed"
            drainSignIns { $0.reject(message, GameKitPlugin.notAuthenticated, error) }
        }
        // Fires again on sign-out / account switch, long after the calls above.
        notifyListeners("playerChanged", data: payload)
    }

    /// Settles and clears every waiting sign-in call, so none is settled twice.
    private func drainSignIns(_ settle: (CAPPluginCall) -> Void) {
        let waiting = pendingSignIns
        pendingSignIns = []
        waiting.forEach(settle)
    }

    // MARK: - scores and achievements

    @objc func submitScore(_ call: CAPPluginCall) {
        guard let leaderboardID = call.getString("leaderboardId"), !leaderboardID.isEmpty else {
            call.reject("leaderboardId is required", GameKitPlugin.invalidArgument)
            return
        }
        guard let score = call.getInt("score") else {
            call.reject("score is required", GameKitPlugin.invalidArgument)
            return
        }
        guard GameCenter.isAuthenticated else {
            call.reject("Not signed in to Game Center", GameKitPlugin.notAuthenticated)
            return
        }
        GameCenter.submitScore(score, leaderboardID: leaderboardID) { error in
            GameKitPlugin.settle(call, error)
        }
    }

    @objc func unlockAchievement(_ call: CAPPluginCall) {
        guard let achievementID = call.getString("achievementId"), !achievementID.isEmpty else {
            call.reject("achievementId is required", GameKitPlugin.invalidArgument)
            return
        }
        guard GameCenter.isAuthenticated else {
            call.reject("Not signed in to Game Center", GameKitPlugin.notAuthenticated)
            return
        }
        GameCenter.reportAchievement(id: achievementID, percent: call.getDouble("percent", 100)) { error in
            GameKitPlugin.settle(call, error)
        }
    }

    private static func settle(_ call: CAPPluginCall, _ error: Error?) {
        if let error = error {
            call.reject(error.localizedDescription, GameKitPlugin.gameKitFailed, error)
        } else {
            call.resolve()
        }
    }

    // MARK: - native Game Center screens

    @objc func showLeaderboard(_ call: CAPPluginCall) {
        guard let leaderboardID = call.getString("leaderboardId"), !leaderboardID.isEmpty else {
            call.reject("leaderboardId is required", GameKitPlugin.invalidArgument)
            return
        }
        DispatchQueue.main.async {
            self.presentGameCenter(GKGameCenterViewController(leaderboardID: leaderboardID,
                                                              playerScope: .global,
                                                              timeScope: .allTime),
                                   for: call)
        }
    }

    @objc func showAchievements(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            self.presentGameCenter(GKGameCenterViewController(state: .achievements), for: call)
        }
    }

    /// Resolves as soon as the sheet is on screen, so a player who leaves it
    /// open can never leave the JS promise hanging. Dismissal is handled by
    /// `gameCenterViewControllerDidFinish`.
    private func presentGameCenter(_ viewController: GKGameCenterViewController, for call: CAPPluginCall) {
        // gameCenterDelegate is weak; the plugin instance is owned by the
        // bridge for the life of the app, so it outlives the sheet.
        viewController.gameCenterDelegate = self
        if present(viewController) {
            call.resolve()
        } else {
            call.reject("No view controller to present Game Center from", GameKitPlugin.noViewController)
        }
    }

    public func gameCenterViewControllerDidFinish(_ gameCenterViewController: GKGameCenterViewController) {
        gameCenterViewController.dismiss(animated: true)
    }

    // MARK: - presentation

    /// GameKit screens go on top of whatever is already presented: presenting
    /// from the bridge's own controller fails while another sheet (ATT, the
    /// AdMob consent form) is up.
    @discardableResult
    private func present(_ viewController: UIViewController) -> Bool {
        guard let host = topViewController() else { return false }
        host.present(viewController, animated: true)
        return true
    }

    private func topViewController() -> UIViewController? {
        var top: UIViewController? = bridge?.viewController ?? keyWindow()?.rootViewController
        while let presented = top?.presentedViewController {
            top = presented
        }
        return top
    }

    private func keyWindow() -> UIWindow? {
        return UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .flatMap { $0.windows }
            .first { $0.isKeyWindow }
    }
}
