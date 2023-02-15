from libqtile.bar import Bar

from libqtile.widget.tasklist import TaskList
from libqtile.widget.widgetbox import WidgetBox
from libqtile.widget.memory import Memory
from libqtile.widget.cpu import CPU
from libqtile.widget.load import Load
from libqtile.widget.groupbox import GroupBox
from libqtile.widget.currentlayout import CurrentLayout
from libqtile.widget.windowname import WindowName
from libqtile.widget.chord import Chord
from libqtile.widget.pomodoro import Pomodoro
from libqtile.widget.statusnotifier import StatusNotifier
from libqtile.widget.systray import Systray
from libqtile.widget.clock import Clock
from libqtile.widget.quick_exit import QuickExit
from libqtile.widget.net import Net

from widgets.wireplumber import WireplumberVolume


def task_bar():
    return Bar(
        [
            TaskList(),
            WidgetBox([Memory(), CPU(), Load()]),
        ],
        24,
    )


def top_bar():
    return Bar(
        [
            CurrentLayout(),
            GroupBox(),
            Chord(
                chords_colors={
                    "launch": ("#ff0000", "#ffffff"),
                },
                name_transform=lambda name: name.upper(),
            ),
            WindowName(),
            Net(),
            Pomodoro(),
            Systray(),
            Clock(format="%Y-%m-%d %a %H:%M %p"),
            WireplumberVolume(),
            QuickExit(),
        ],
        24,
    )
