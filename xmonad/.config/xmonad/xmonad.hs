import XMonad
import XMonad.Hooks.DynamicLog
import XMonad.Layout.NoBorders
import XMonad.Layout.Renamed
import XMonad.Util.EZConfig
import Graphics.X11.ExtraTypes.XF86


-- launch XMonad with a status bar and overridden configuration
main = xmonad =<< statusBar myBar myPP myToggleStrutsKey  myConfig


-- general configuration with keyboard customisation
myConfig = def
  { modMask             = myModMask
  , terminal            = myTerminal
  , startupHook         = myStartupHook
  , layoutHook          = myLayout
  , manageHook          = myManageHook
  , borderWidth         = 2
  , normalBorderColor   = "gray20"
  , focusedBorderColor  = "white"
  } `additionalKeys`

  -- launch dmenu
  [ ((myModMask,                xK_p     ), spawn ("dmenu_run " ++ myDmenuArgs))
  -- launch j4-dmenu-desktop
  , ((myModMask .|. shiftMask,  xK_p     ), spawn ("j4-dmenu-desktop --dmenu=\"dmenu -i " ++ myDmenuArgs ++ "\" --term=\"" ++ myTerminal ++ "\""))

  -- launch browser
  , ((myModMask .|. shiftMask,  xK_o     ), spawn (myBrowser ++ " >/dev/null 2>&1"))

  -- launch steam
  , ((myModMask .|. shiftMask,  xK_m     ), spawn ("steam"))

  -- volume control
  , ((noModMask,                xF86XK_AudioMute        ), spawn "xmobarPulseVolume mute")
  , ((noModMask,                xF86XK_AudioLowerVolume ), spawn "xmobarPulseVolume down")
  , ((noModMask,                xF86XK_AudioRaiseVolume ), spawn "xmobarPulseVolume up")
  , ((noModMask,                xF86XK_AudioMicMute     ), spawn "xmobarPulseVolume mute-input")

  -- brightness controls
  , ((noModMask,                xF86XK_MonBrightnessDown), spawn "xbacklight -dec 10%")
  , ((noModMask,                xF86XK_MonBrightnessUp  ), spawn "xbacklight -inc 10%")

  -- twiddle displays
  , ((noModMask,                xF86XK_Display          ), spawn myTwiddleDisplaysCmd)
  , ((myModMask .|. shiftMask,  xK_y                    ), spawn myTwiddleDisplaysCmd)
  , ((myModMask .|. shiftMask,  xK_t                    ), spawn myTwiddleDisplaysMirroredCmd)

  -- toggle redshift
  , ((myModMask .|. shiftMask,  xK_r                    ), spawn myToggleRedshiftCmd)

  -- lock the screen
  , ((myModMask .|. shiftMask,  xK_l                    ), spawn "xautolock -locknow")

  -- take screenshots
  , ((noModMask,                xK_Print                ), spawn "sleep 0.2; cd /tmp && scrot -s -e 'xdg-open $f &'")
  , ((myModMask,                xK_Print                ), spawn "           cd /tmp && scrot    -e 'xdg-open $f &'")
  ]


-- status bar xmobar on primary X display
myBar = "xmobar"
myPP = xmobarPP -- http://code.haskell.org/XMonadContrib/
  { ppSep       = "   "
  , ppTitle     = xmobarColor "green" "" . shorten 140
  }
myToggleStrutsKey XConfig { XMonad.modMask = modMask } = (modMask, xK_b)


-- startup
myStartupHook = do

  -- write to the named pipe for xmobar volume
  spawn "xmobarPulseVolume"


-- application specific overrides; use xprop to investigate a running window
myManageHook = composeAll
   [ className =? "net-sourceforge-jnlp-runtime-Boot"   --> doFloat     -- iced tea javaws
   , className =? "FTL.amd64"                           --> doFloat
   , className =? "Xmessage"                            --> doFloat ]


-- layouts
myLayout = smartBorders $ Full ||| tall ||| wide
  where
     tall    = Tall nmaster delta ratio
     wide    = renamed [ Replace "Wide" ] $ Mirror tall

     -- number of windows in the master pane
     nmaster = 1

     -- Default proportion of screen occupied by master pane
     ratio   = 1/2

     -- Percent of screen to increment by when resizing panes
     delta   = 3/100


-- update monitor outputs and restart xmonad
myTwiddleDisplaysCmd = "xlayoutdisplay && xmonad --restart"
myTwiddleDisplaysMirroredCmd = "xlayoutdisplay -m && xmonad --restart"

-- toggle redshift
myToggleRedshiftCmd = "if [ $(systemctl --user is-active redshift) = active ] ; then systemctl --user stop redshift ; else systemctl --user start redshift; fi"

-- common dmenu args
myDmenuArgs = "-b -nf 'white' -sf 'yellow' -nb 'gray20' -sb 'gray30' -fn 'Monospace-11:bold'"

-- mod key of choice - super
myModMask = mod4Mask -- Super_L

-- terminal of choice
myTerminal = "alacritty"

-- browser of choice
myBrowser = "firefox-beta"
