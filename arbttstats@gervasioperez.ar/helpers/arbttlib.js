/* -*- mode: js; js-basic-offset: 4; indent-tabs-mode: nil -*- */
/*
  Copyright (c) 2021, Gervasio Perez <sherwoodinc@gmail.com>

  Redistribution and use in source and binary forms, with or without
  modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of the GNOME nor the
      names of its contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.

  THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
  ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
  WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
  DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER BE LIABLE FOR ANY
  DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
  (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
  LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
  ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
  (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
  SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

const Gettext = imports.gettext;
const { Gio, GLib } = imports.gi;

/* arbtt-stats options -- for self reference
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

async function execCommunicate(argv, input = null, cancellable = null) {
  let cancelId = 0;
  let flags = (Gio.SubprocessFlags.STDOUT_PIPE);// |
                //Gio.SubprocessFlags.STDERR_PIPE);

  if (input !== null)
      flags |= Gio.SubprocessFlags.STDIN_PIPE;

  let proc = new Gio.Subprocess({
      argv: argv,
      flags: flags
  });
  proc.init(cancellable);

  if (cancellable instanceof Gio.Cancellable) {
      cancelId = cancellable.connect(() => proc.force_exit());
  }

  return new Promise((resolve, reject) => {
      proc.communicate_utf8_async(input, null, (proc, res) => {
          try {
              let [, stdout, stderr] = proc.communicate_utf8_finish(res);
              let status = proc.get_exit_status();

              if (status !== 0) {
                  throw new Gio.IOErrorEnum({
                      code: Gio.io_error_from_errno(status),
                      message: stderr ? stderr.trim() : GLib.strerror(status)
                  });
              }

              resolve(stdout.trim());
          } catch (e) {
              reject(e);
          } finally {
              if (cancelId > 0) {
                  cancellable.disconnect(cancelId);
              }
          }
      });
  });
}

async function runshell(cmd, stdinput = null) {  
  let output = await execCommunicate(cmd, input = stdinput);
  return output;
}

function runshell_sync(cmd) {
    return imports.byteArray.toString(GLib.spawn_command_line_sync(cmd)[1]);
  }


 function build_date_filter(settings) {
    let today = GLib.DateTime.new_now_local().format("\%F");
    switch (settings.stats_interval) {
      case "current day": break;
      case "current week":
        today = GLib.DateTime.new_now_local();
        today = today.add_days(-today.get_day_of_week());
        if (settings.week_start_day == "Monday") today = today.add_days(1);
        today = GLib.DateTime.new_local(today.get_year(), today.get_month(), today.get_day_of_month(), 0, 0, 0);
        today = today.format("\%F");
        break;
      case "current month":
        today = GLib.DateTime.new_now_local();
        today = GLib.DateTime.new_local(today.get_year(), today.get_month(), 1, 0, 0, 0);
        today = today.format("\%F");
        break;
     };

     return "--filter=$date>=" + today + "";
}

function build_arbtt_command_line(settings) {
  let cmdline = ["arbtt-stats", "--output-format=csv"];
  try {
    if (!settings.ignore_inactive) cmdline.push("--also-inactive");
    if (settings.logs_path.length > 0) cmdline.push("--logfile=" + settings.logs_path);
    if (settings.categorize_path.length > 0) cmdline.push("--categorizefile=" + settings.categorize_path);

    for (let i = 0; i < settings.included_categories.length; ++i) cmdline.push("--category=" + settings.included_categories[i]);
    if (settings.excluded_categories.length > 0)
      for (let i = 0; i < settings.excluded_categories.length; ++i) cmdline.push("--exclude=" + settings.excluded_categories[i]);
     cmdline.push(build_date_filter(settings));
     
  } catch (e) {
    log(e);
  }

  return cmdline;
}

function build_arbtt_raw_entries_command_line(settings, tag) {
  let cmdline = ["arbtt-stats", "--dump-samples"];
  try {
    if (!settings.ignore_inactive) cmdline.push("--also-inactive");
    if (settings.logs_path.length > 0) cmdline.push("--logfile=" + settings.logs_path);
    if (settings.categorize_path.length > 0) cmdline.push("--categorizefile=" + settings.categorize_path);
    cmdline.push("--only=" + tag);
    cmdline.push(build_date_filter(settings));
  } catch (e) {
    log(e);
  }

  return cmdline;
}


function parse_arbtt_csv_output(categories_csv) {
  let categories = [];
  try {
    categories_csv = categories_csv.split("\n");
    let i = 0;
    for (i = 0; i < categories_csv.length; ++i) {
      if (categories_csv[i].length > 1) {
        categories_csv[i] = categories_csv[i].split(',');
      }
      else
        categories_csv[i] = [];
    }

    for (i = 1; i < categories_csv.length; ++i) {
      if (categories_csv[i].length > 0) {
        let v = {};
        for (let j = 0; j < categories_csv[0].length; ++j)
          v[categories_csv[0][j]] = categories_csv[i][j];

        if (!v["Tag"]) continue;
        if (v["Tag"] == "(unmatched time)") continue;
        if (v["Tag"] == "(total time)") continue;
        if (v["Tag"].match(/[0-9]+ entries omitted/)) continue;

        let c = {
          raw_tag: v["Tag"],
          tag: v["Tag"].split(":"),
          category: v["Tag"].split(":")[0],
          percentage: parseFloat(v["Percentage"]),
          time: v["Time"],
          time_hms: v["Time"].split(":").map((v) => { return parseInt(v); }),
        };
        c.tag = c.tag[c.tag.length - 1];
        c.time_minutes = c.time_hms[0] * 60 + c.time_hms[1];
        c.time_hm_str = (c.time_hms[0] > 0 ? c.time_hms[0].toString() + "h" : "") +
          (c.time_hms[1] > 0 ? c.time_hms[1].toString() + "m" : "");
        categories.push(c);
      }

    }
  } catch (e) {
    // return empty category list on error
    log(e);
  }
  return categories;
}

function parse_arbtt_raw_entries(raw_entries) {
  function parse_line(st) {
    let s = st.trim();
    return [s.split(/[ ]+/).slice(0,3), s.split(":").slice(1,9999).join(":").trim()];
  }

  let entries = [];
  try {
    raw_entries = raw_entries.split("\n");
    raw_entries.forEach( (l) => {
    let line = parse_line(l);
    if (line.length > 0 && line[0].length > 1 && line[0][1][0] == "(") {
      let entry = {
      // Line format example:
      //      1     (*) gnome-terminal-server: sudo apt install glade
      frequency: parseInt(line[0][0]),
      active: line[0][1] == "(*)",
      program: line[0][2].substr(0,line[0][2].length-1),
      title: line[1]
      }
      entries.push(entry);
      }
    });

  } catch (e) {
    log (e);
  }

  return entries;
}

async function read_arbtt_stats(settings) {
  return new Promise((resolve, reject) => {
    try{
    let argv = build_arbtt_command_line(settings);
    log("Running command: " + argv.toString());
    execCommunicate(argv).then( (categories_csv) => {
    let categories = parse_arbtt_csv_output(categories_csv);
    resolve(categories);
    });
    } catch (e) {
      reject(e);
    }
  });
}

async function fetch_arbtt_entries_for_tag(settings, tag) {
  if (settings.entries_to_fetch == 0) return [];

  let argv = build_arbtt_raw_entries_command_line(settings, tag);
  output1 = await runshell(argv);
  output2 = await runshell(["fgrep","(*)"], output1);
  output3 = await runshell(["sort"], output2);
  output4 = await runshell(["uniq","-c"], output3);
  output5 = await runshell(["sort","--reverse","--general-numeric-sort"], output4);
  if (settings.events_to_fetch > 0) {
    output5 = output5.split("\n").slice(0,settings.events_to_fetch).join("\n");            
  }  
  return parse_arbtt_raw_entries(output5);        
}

function categories_file_open(file) {
        if (file.length < 1) file = "~/.arbtt/categorize.cfg";
        runshell_sync("sh -c 'xdg-open " + file+"'");
}

function build_rule_templates_from_event(settings,event) {
  rules = []
  rules.push("-- Added by Arbtt-stats gnome extension");
  rules.push("-- current window \\$program == \\\"" + event.program + "\\\" ==\\> tag CATEGORY:TAG_NAME,");
  rules.push("-- current window \\$program =~ /.*" + event.program + ".*/ ==\\> CATEGORY:TAG_NAME,");
  rules.push("-- current window \\$title == \\\"" + event.title + "\\\" ==\\> tag CATEGORY:TAG_NAME,");
  rules.push("-- current window \\$title =~ /.*" + event.title + ".*/ ==\\> tag CATEGORY:TAG_NAME,");
  // Append each commented rule template to the categories file
  let file = settings.categorize_path.length > 0 ? settings.categorize_path : "~/.arbtt/categorize.cfg";
  rules.forEach( (rule) => {
    let cmd = "bash -c 'echo "+rule+" >> " + file+"'";
    log(cmd)
    runshell_sync(cmd);
  });

  categories_file_open(settings.categorize_path);
}

