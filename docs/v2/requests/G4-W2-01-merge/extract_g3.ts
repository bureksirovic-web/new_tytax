import * as fin from '/home/tomi/Projects/tytax-v2/g3/src/components/workout/strings/finish';
import * as mus from '/home/tomi/Projects/tytax-v2/g3/src/components/workout/strings/muscles';
import * as pick from '/home/tomi/Projects/tytax-v2/g3/src/components/workout/strings/picker';
import * as sets from '/home/tomi/Projects/tytax-v2/g3/src/components/workout/strings/sets';
import * as start from '/home/tomi/Projects/tytax-v2/g3/src/components/workout/strings/start';
import * as timer from '/home/tomi/Projects/tytax-v2/g3/src/components/workout/strings/timer';
import * as setup from '/home/tomi/Projects/tytax-v2/g3/src/components/workout/strings/setup';
import * as time from '/home/tomi/Projects/tytax-v2/g3/src/components/workout/strings/time';
import * as tools from '/home/tomi/Projects/tytax-v2/g3/src/components/tools/tools-strings';
const out: Record<string, Record<string, {en: Record<string,string>, hr: Record<string,string>}>> = {};
for (const [file, mod] of Object.entries({finish: fin, muscles: mus, picker: pick, sets, start, timer, tools, setup, time})) {
  for (const [name, v] of Object.entries(mod as Record<string, unknown>)) {
    if (v && typeof v === 'object' && 'en' in (v as object) && 'hr' in (v as object)) (out[file] ??= {})[name] = v as never;
  }
}
console.log(JSON.stringify(out, null, 1));
