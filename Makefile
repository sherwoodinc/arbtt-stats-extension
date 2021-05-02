
all: schemas package

schemas:
	cd arbttstats@gervasioperez.ar; glib-compile-schemas schemas

package:
	cd arbttstats@gervasioperez.ar; gnome-extensions pack --extra-source=arbtt.js --extra-source=convenience.js --schema=schemas/org.gnome.shell.extensions.arbttstats.gschema.xml
