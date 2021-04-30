/* extension.js
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 *
 * SPDX-License-Identifier: GPL-2.0-or-later
 */

/* exported init */

const GETTEXT_DOMAIN = 'arbtt-stats';

const { GObject, St, Gio, GLib, Gtk, Clutter } = imports.gi;

const Gettext = imports.gettext.domain(GETTEXT_DOMAIN);
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;

const CE = ExtensionUtils.getCurrentExtension();
const extensionPath = CE.path;

const Lang = imports.lang;

function log_status()
{        
    logfile = Gio.file_new_for_path(GLib.get_user_cache_dir()+"/arbttstats-extension.log");
 
let fileOutput = logfile.append_to(Gio.FileCreateFlags.PRIVATE,null);
    if(!arguments[0])
    fileOutput.write("\n",null);
    else
    fileOutput.write("["+new Date().toString()+"] "+arguments[0]+"\n",null);
fileOutput.close(null);
return 0;
}

// A simple bar
var PopupBarMenuItem = GObject.registerClass(
    class PopupBarMenuItem extends PopupMenu.PopupBaseMenuItem {
        _init(text, xwidth) {
            
            super._init({
                style_class: 'popup-separator-menu-item',
                reactive: false,
                can_focus: false,
            });
    
            this.label = new St.Label({ 
                style_class: 'arbtt-stats',
                text: text, 
            });
            this.label_actor = this.label;            
        
            this._separator = new St.Widget({
                style_class: 'arbtt-stats-progress-bar',
                width: xwidth,
                x_expand: false,
                x_align: Clutter.ActorAlign.START,
                y_expand: true,
                y_align: Clutter.ActorAlign.CENTER,
            });
            this.add_child(this._separator);
            this.add_child(this.label_actor);
            this.label.connect('notify::text', this._syncVisibility.bind(this));
            this._syncVisibility();

        }
    
        _syncVisibility() {
            this.label.visible = this.label.text != '';
        }
    });
    

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {

    open_prefs() {
        GLib.spawn_command_line_async("gnome-extensions prefs arbttstats@gervasioperez.ar");
    }
    /*
  -h, -?       --help                  show this help
  -V           --version               show the version number
               --logfile=FILE          use this file instead of ~/.arbtt/capture.log
               --categorizefile=FILE   use this file instead of ~/.arbtt/categorize.cfg
  -x TAG       --exclude=TAG           ignore samples containing this tag or category
  -o TAG       --only=TAG              only consider samples containing this tag or category
               --also-inactive         include samples with the tag "inactive"
  -f COND      --filter=COND           only consider samples matching the condition
  -m PERC      --min-percentage=PERC   do not show tags with a percentage lower than PERC% (default: 1)
               --output-exclude=TAG    remove these tags from the output
               --output-only=TAG       only include these tags in the output
  -i           --information           show general statistics about the data
  -t           --total-time            show total time for each tag
  -c CATEGORY  --category=CATEGORY     show statistics about category CATEGORY
               --each-category         show statistics about each category found
               --intervals=TAG         list intervals of tag or category TAG
               --dump-samples          Dump the raw samples and tags.
               --output-format=FORMAT  one of: text, csv (comma-separated values), tsv (TAB-separated values) (default: Text)
               --for-each=PERIOD       one of: day, month, year

    */
    
 	  read_arbtt_stats(settings) {
        let today = GLib.DateTime.new_now_local().format("\%F");
        let cmdline = "arbtt-stats --output-format=csv";
        if (!settings.ignore_inactive) cmdline += " --also-inactive";
        if (settings.logs_path.length > 0) cmdline += " --logfile="+settings.logs_path;
        if (settings.categorize_path.length > 0) cmdline += " --categorizefile="+settings.categorize_path;

        for (let i=0; i < settings.included_categories.length; ++i) cmdline += " --category="+settings.included_categories[i];
        if (settings.excluded_categories.length > 0)
        for (let i=0; i < settings.excluded_categories.length; ++i) cmdline += " --exclude="+settings.excluded_categories[i];
                
        switch(settings.stats_interval) {
        case "current day": break;
        case "current week": 
          today = GLib.DateTime.new_now_local();
          today = today.add_days(-today.get_day_of_week());
          if (settings.week_start_day == "Monday") today = today.add_days(1);
          today = GLib.DateTime.new_local(today.get_year(), today.get_month(), today.get_day_of_month(),0,0,0);
          today = today.format("\%F");
          break;
          case "current month":
          today = GLib.DateTime.new_now_local();
          today = GLib.DateTime.new_local(today.get_year(), today.get_month(), 1,0,0,0);          
          today = today. format("\%F");
          break;
        };        
        cmdline += " --filter='$date>="+today+"'";
        
        log_status(cmdline);
        let categories_csv = String(GLib.spawn_command_line_sync(cmdline)[1]).split('\n');
        //categories_csv.forEach( (c) => {log_status(c);} );
        //log_status(categories_csv[categories_csv.length-1]);
        
        let i = 0;
        for (i=0; i<categories_csv.length; ++i) {        
            if (categories_csv[i].length > 1)             
            {
            log_status(categories_csv[i]);
              categories_csv[i] = categories_csv[i].split(',');
              }
            else
              categories_csv[i] = [];
        }
        let categories = [];
        for (i=1; i<categories_csv.length-1; ++i) {
            if (categories_csv[i].length>0) {
            let v = {};
              for (let j=0; j < categories_csv[0].length; ++j)
                  v[categories_csv[0][j]] = categories_csv[i][j];
              categories.push(v);
            }            
        }
        return categories;    
    }  
    
    toggle_interval() {
    log_status("Toggling 1...");
    this._parent.toggle_interval();
    }
    
    refresh(settings) {
        let categories = this.read_arbtt_stats(settings);
        
        this.menu.removeAll();

        let totalTime = 0;
        let interval_text = "Today"
        switch(settings.stats_interval) {
        case "current week":
        interval_text = "This week"; break;
        case "current month":  
        interval_text = "This month"; break;
        };
        //let item = new PopupMenu.PopupMenuItem(interval_text);
        //item.connect("activate", Lang.bind(this, this.toggle_interval ));
        //this.menu.addMenuItem(item);
        let i=0;
        for (i=0; i< categories.length; ++i) {
         let frac = (parseInt(categories[i]["Percentage"].split(".")[0]));
         let time = categories[i]["Time"].split(":");
         time[0] = parseInt(time[0]);
         time[1] = parseInt(time[1]);
         totalTime += 60*time[0] + time[1];
         time = (time[0] == 0 ? "" : time[0].toString() + "h") +
                (time[1] == 0 ? "" : time[1].toString() + "m");
         let task = categories[i]["Tag"];
         if (settings.strip_categories) {
          task = task.split(":");
          task = task[task.length-1];
         }         
         let item = new PopupBarMenuItem(time+ " -- "+task, frac*2);
         this.menu.addMenuItem(item);
        }
        totalTime = (totalTime>60 ? Math.floor(totalTime/60).toString() + "h" : "") + 
                    (totalTime%60).toString()+"m";                    

        let icon = new St.Icon({
            icon_name: 'emblem-synchronizing-symbolic',
            style_class: 'system-status-icon',
        }
        );
        
        let item = new PopupMenu.PopupImageMenuItem(interval_text + " | Logged time: "+ totalTime, icon.gicon);
        item.connect("activate", Lang.bind(this, this.toggle_interval ));
        this.menu.addMenuItem(item);
        
        icon = new St.Icon({
            icon_name: 'emblem-system-symbolic',
            style_class: 'system-status-icon',
        }
        );
        item = new PopupMenu.PopupImageMenuItem("Configure", icon.gicon);
        item.connect("activate", this.open_prefs);
        this.menu.addMenuItem(item);
    }
  
    _init(parent) {
        super._init(0.0, _('Arbtt Stats'));
        this._parent = parent;

        let box = new St.BoxLayout({ style_class: 'panel-status-menu-box' });
        box.add_child(new St.Icon({
            icon_name: 'emblem-urgent',
            style_class: 'system-status-icon',
        }
        ));
        this.add_child(box);
        
        
    }
});

class Extension {
    constructor(uuid) {
        this._uuid = uuid;
        this.timer = null;
        this.settings = ExtensionUtils.getSettings(
            'org.gnome.shell.extensions.arbttstats');
        ExtensionUtils.initTranslations(GETTEXT_DOMAIN);        
    }
    
    toggle_interval() {
    log_status("Toggling 2...");
      let result ="";
      switch(this.settings.get_string("stats-interval")) {
      case "current day": result = "current week"; break;
      case "current week": result = "current month"; break;
      case "current month": result = "current day"; break;
      }
      this.settings.set_string("stats-interval", result);
      this.refresh();
      log_status("Toggling 3...");
    }

    refresh() {
        var settings = {
          interval: this.settings.get_int("refresh-interval-seconds"),
          strip_categories: this.settings.get_boolean("strip-category-names"),
          logs_path: this.settings.get_string("log-file-path"),
          categorize_path: this.settings.get_string("categorize-file-path"),
          ignore_inactive: this.settings.get_boolean("ignore-inactive"),
          included_categories: this.settings.get_string("included-categories"),
          excluded_categories: this.settings.get_string("excluded-categories"),
          stats_interval: this.settings.get_string("stats-interval"),          
          week_start_day: this.settings.get_string("week-start-day")
        };
        if (settings.included_categories.length > 0)
          settings.included_categories = settings.included_categories.split(",");
          else 
          settings.included_categories = [];
        if (settings.excluded_categories.length > 0)
          settings.excluded_categories = settings.excluded_categories.split(",");
          else         
          settings.excluded_categories = [];
        if (!this._indicator) {
          this._indicator = new Indicator(this);
          Main.panel.addToStatusArea(this._uuid, this._indicator);
          }
        this._indicator.refresh(settings);
        this._interval = settings.interval;                
    }

    enable() {
        this.refresh();
        this.timer  = GLib.timeout_add(GLib.PRIORITY_DEFAULT, this._interval*1000, imports.lang.bind(this, function() { this._update(); return true;}));
    }
    
    disable() {
        if (this.timer)
            GLib.source_remove(this.timer);
        this.timer = null;
        if (this._indicator)
          this._indicator.destroy();
        this._indicator = null;
    }

    _update() {
      if (this._indicator)
        this._indicator.destroy();
      this._indicator = null;
      this.refresh();
    }
}
function init(meta) {
    return new Extension(meta.uuid);
}
