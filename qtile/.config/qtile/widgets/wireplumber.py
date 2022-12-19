import subprocess
import shlex
from libqtile.widget.volume import Volume
from libqtile.widget import base


class WireplumberVolume(Volume):
    def __init__(self, **config):
        base._TextBox.__init__(self, "0", **config)
        self.add_defaults(Volume.defaults)
        self.surfaces = {}
        self.volume = None
        self.add_callbacks(
            {
                "Button1": self.open_qpwgraph,
            }
        )

    def get_volume(self):
        try:
            a = self.call_process(shlex.split("wpctl get-volume @DEFAULT_AUDIO_SINK@"))
            if a.startswith("Volume: "):
                return float(a[8:]) * 100
            else:
                return -1
        except (subprocess.CalledProcessError, ValueError):
            return -1

    def open_qpwgraph(self):
        subprocess.Popen(shlex.split("qpwgraph"), shell=True)
