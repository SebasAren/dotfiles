from libqtile import bar
from libqtile.widget.tasklist import TaskList
from libqtile.widget.widgetbox import WidgetBox
from libqtile.widget.memory import Memory
from libqtile.widget.cpu import CPU


def task_bar():
    return bar.Bar(
        [
            TaskList(),
            WidgetBox([Memory(), CPU()]),
        ],
        24,
    )
