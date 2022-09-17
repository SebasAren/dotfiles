import XMonad
import XMonad.Config.Desktop

main :: IO()
main = xmonad $ desktopConfig {
    modMask = mod4Mask
    , terminal = myTerminal
    , startupHook = myStartupHook
  }

myTerminal :: String
myTerminal = "alacritty"

myStartupHook :: X ()
myStartupHook = do
  spawn "xmobar"
