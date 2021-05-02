
all: schemas package

schemas:
	cd arbttstats@gervasioperez.ar; glib-compile-schemas schemas

package:
	cd arbttstats@gervasioperez.ar; gnome-extensions pack --force --extra-source=arbtt.js --extra-source=convenience.js 
