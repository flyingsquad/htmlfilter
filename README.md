# htmlfilter -- Character Sheet and Statblock Exporter for Foundry

This is intended primarily for exporting all the details of DnD5e characters to record them for posterity or check them for accuracy. The character sheet in Foundry has so many sections that it can be daunting to check each item.

*Note:* you must be accessing Foundry with a browser that allows you create tabs. The Foundry VTT app itself does not allow this, so you'll need to access the world from a separate browser.

**How It Works:** A tab is created in the browser and the text of the character's abilities, skills, features, etc., are written to it in HTML format based on the filter you have selected in the settings. You can switch to the tab and use the browser's print functionality to print the text to a printer or save to a PDF file. See below for saving the HTML directly to a file.

To export characters open the character sheet and click the HTML Filter icon in the title bar.

The following configuration settings are available:

## Filter file

The name of the filter file. The default is modules/htmlfilter/filters/dnd5e.txt. Currently two are available, for DnD5e: **dnd5e.txt**, formatted like a character sheet; and **dndstatblock.txt**, formatted like a statblock.

These filters are HTML files with .txt extensions. If you add your own filters you should create them in a different folder under Foundry's data folder so that they will not be lost when you update this module. Creating a filter is like writing an HTML file with special references to the data (see below).

## Show Long Descriptions

Show the long descriptions for items. If unchecked, only the brief details of the item are shown. The exact details shown vary by type of item (equipment, weapons, class, etc.). Items that are equipped are indicated by a preceding bullet.

Note that the details for some items (classes, races) can be quite lengthy, so you may wish to omit all that boilerpalte.

## Maximum Detail Length

If the details of an item exceed this length, the details will not be displayed. This is for items such as race, which are very long and filled with information included in other items. This length includes any HTML formatting that may be included in the details, so you may need to set this higher than would seem necessary to get certain items' details to display if they are highly formatted.

## Full Spell Book

Show the full details all spells. If unchecked, only the names of the spells are displayed at each level. Prepared spells are indicated by a preceding bullet.

## Items to Ignore

A semicolon-delimited list of items that will be ignored in item lists. The default value is "Age;Languages". These appear in all DnD5e character sheets but don't have any information associated with them (the actual languages are indicated elsewhere), so they are just a waste of space.

## Image Height

Height in pixels of the character image, if there is one. To omit the image, enter 0.

# Saving the HTML to a File

Because a newly created tab has no file associated with it, you can't directly save the HTML generated for the stat block to file. This is a limitation of the "about:blank" tab that is used to create the stat block. You can, however, use the debugging features of the browser to copy the HTML and put it in a file.
- Right-click the first line (the character's name) of the stat block.
- In Chrome or Firefox, select the Inspect command from the context menu. The debugger pane of the browser will open.
- Right-click the <html> tag at the top of the debugger pane.
- Select the Copy > Copy Element command in Chrome, or the Copy > Outer HTML in Firefox. Other browsers will have similar commands.
- Press F12 to close the browser debugger pane.
- Switch to an editor that can accept plain text, such as Notepad or Notepad++.
- Paste the text.
- Save the file with a .html extension.
- The file can now be opened with a browser or HTML editor.
- Note that the character image will not be copied this way: it is a reference to a location in the Foundry Data hierarchy and you'll need to copy that separately.

# Creating a Filter
  
A filter file is formatted as standard HTML, with a .txt extension.
  
Some of the data in the character sheet is available through short names, while more obscure data can be referenced through the data structures of the actual actor objects.

A property is referenced within the HTML filter with @{...} (at and curly braces), where the ... is the name of a property or an expression. If the contents of @{...} cannot be evaluated the expression is emitted directly into the output to show you what did not compute.
  
For example, you can reference the character's name inside header tags with:
  
```html
<h1>@{name}</h1>
```

To reference the character's Strength and Strength modifier you would use:

```html
<td align="center">@{str}<br>(@{sign(strMod)})</td>
```

The sign function places a '+' before numbers greater than zero.

To reference the biography you would use an object reference to the properties of the actor object:

```html
<p class='biography'>@{system.details.biography.value}</p>
```

The following directives are available for programmatically accessing character sheet data:

## @@if{...} ... @@endif

If the expression inside the {...} evaluates to true (non-zero, or a non-empty string) all the text between the @if and the corresponding @@endif is processed and displayed. For example:

```html
@@if{actorType != 'character'}
<p class="exdent"><b>Challenge</b> @{system.details.cr} (@{system.details.xp.value} XP)</p>
@@endif
```

## @@foreach{<type>} ... @@endforeach

Iterates through the items of the specified type. Names of items are referenced with @{itemname}, and their stats are referenced with @{itemstats}. The extended details are referenced with @{itemdetails}. For example:

```html
@@if{count('weapon')>0}
 <h2>Attacks</h2>
 @@foreach{weapon}
  <p class="exdent"><b>@{itemname}</b>. @{itemstats}</p>
  @@if{showDetails}
   <p class="desc">@{itemdetails}</p>
  @@endif
 @@endforeach
@@endif
```
The count() function returns the count of items of the specified type. Types in a DnD5e character sheet include weapon, class, subclass, feat, equipment, consumable, loot, tool, spell, etc. Other game systems may have other types.

The value @{itemstats} is dynamically generated by the underlying DnD5e module. It includes several properties, such as attack type, quantity, AC, activation,  number of uses, damage, duration, target, price, weight. For example:

```
Shocking Grasp Melee: +7 to hit, 2d8 lightning damage, 1 creature
Potion of Healing 2d4+2 healing, 1 creature, 50gp, Weight: 0.1
```

Within a @@foreach you can also access any item properties with a dotted reference to "item". For example, when processing @@foreach{class} you could reference @{item.system.levels} to get the number of levels in the currently processed class.

## @@for{...} ... @@endfor

Similar to a Javascript or C++ for loop. Inside the {...} are the initializer, control expression and increment, separated by semicolons. The initializer sets the control variable. The control expression is evaluated, and if it is true, the text between the @@for and the @@endfor is processed. After the text is processed the increment is evaluated, updating the control variable. Then the control expression is evaluated again, and if true, the text is processed. Beware of infinite loops!

```html
@@for{slot=1; slot < 10; slot = slot + 1}
	@@define{nslots = *('system.spells.spell' + slot + '.max')}
	@@if{nslots > 0}
		...
	@@endif
@@endfor
```
This example also illustrates the @@define directive and "indirection," which allows you to construct a reference to a property in the character sheet and then get at it. In the above example the character sheet includes properties "system.spells.spell1.max", "system.spells.spell2.max", etc., which are then referenced to determine how many spell slots are available at each level, and then outputting spells at that level if there are slots available.

## @@define{...}

Defines a value, which can be referenced in @{...} expression or an @@if{...}. Note that this will override the predefined values, so choose your defined names carefully. For example:

```html
@@define{prepared=''}
@@if{item.system.preparation.mode = 'prepared' && item.system.preparation.prepared}
	@@define{prepared='•'}
@@endif
```

## @@macro{macroname(ARG1, ARG2, ...)} ... @@endmacro

Defines a macro. All the text between @@macro{} and @@endmacro (the "body" of the macro) is saved and can be invoked with a @@call{macroname(arg1, arg2, ...)} directive.

When the macro is invoked with a @@call wherever the argument names occur in the body they are replaced with the corresponding arguments passed to the @@call. 

This is a direct text replacement of the argument name into the body -- if the argument name occurs in the middle of another word the argument value will replace it. For example, if the argument name is "x" and the corresponding argument value is 3512, and the word "Experience" appears in the macro body, the letter "x" would be replaced, resulting in "E3512perience".

You should therefore chose argument names that do not occur anywhere else in the macro body other than where you wish them to be replaced. 

By convention, the argument names are in all caps to emphasize their purpose and make them less likely to accidentally match and be replaced. The replacement takes place no matter where the argument name occurs, even if it is in the middle of another word.

For example:

```html
@@macro{coin(COIN)}
@@if{system.currency.COIN}@{cdelim}@{system.currency.COIN}COIN@@define{cdelim=', '}@@endif
@@endmacro
...
<p>Coins @@define{cdelim=''}@@call{coin(pp)}@@call{coin(gp)}@@call{coin(ep)}@@call{coin(sp)}@@call{coin(cp)}</p>
```
produces

	Coins 21gp, 35sp

if system.currency.gp is 21 and system.currency.sp is 35.

## @@call{macroname(arg1, arg2, ...)}

Invokes a macro. It outputs the body of the macro and replaces all occurrences of the argument names in the macro body with the corresponding argument to the @@call.

## Predefined Properties
The following character properties are predefined for DnD5e. The names are case-sensitive.

You can write filters for other game systems, but there are no predefined properties. You'll need to reference the full property name. Refer to the documentation for those systems, or you can export an Actor to .json file and see the structure of the actor object for that game system. Note that the .json file doesn't necessarily include all data that may be present in a character sheet. Dnd5e, for example, doesn't load the full names of traits such as languages and proficiencies until the character sheet proper is opened. You may need to spend some time looking at the source code for the system or examining the actor object in the debugger to see what's going on.

For example, the unofficial GURPS 4e system's ST value and point cost can be referenced with 
```
<p>ST @{system.attributes.ST.import} [@{system.attributes.ST.points}]</p>
```

General Character Information:

	title: the character name, placed in the browser tab title bar.

	name

	actorType: values are 'character', 'npc', etc.

	size

	charLevel

	prof: proficiency bonus

	cr: NPC challenge rating

	classList: list of all classes and their levels

	xp, nextLevelXP

 	race

	alignment

	ac: the numerical value of AC

	acdetails: other details about AC, including armor type, etc.

	hp

	playername: name of the character owner if not Gamemaster.

	img: path for character image, which can be inserted into an HTML \<img\> tag.

	speed: a list of all speeds

	initiative

	background: the name of the character's background(s)

Properties Relating to Spellcasting:

	rsak, msak, spelldc, intrsak, intmsak, intspelldc, wisrsak, wismsak, wisspelldc, charsak, chamsak, chaspelldc

	spellcasting: list of all the applicable values from above (more than one for multiclass spellcasters).

	spellAbilities: comma-separated list of spell abilities (e.g., int,wis).

Skill Values: the signed values of the skills.

	acr, ani, arc, ath, dec, his, ins, itm, inv, med, nat, prc, prf, per, rel, slt, ste, sur

	The raw values are also available by referencing the properties directly with system.skills.acr.value, for example.

	skills: list of all skills with a non-zero bonus, separated by commas. Intended for a statblock.

Flags and Settings:

	imgheight: setting for image height

	maxDetails: the maximum number of characters that are displayed for itemdetails (see above).

	showDetails: value of Show Details setting 

	showSpellbook: value of Show Spellbook setting

Various Traits:

	languages, damageResistances, damageImmunities, damageVulnerabilities, conditionImmunities, weaponProficiencies, armorProficiencies, toolProficiencies

	senses: a list of all senses, separated by commas

Abilities:

	str, dex, con, int, wis, cha

	strMod, dexMod, conMod, intMod, wisMod, chaMod

	strSave, dexSave, conSave, intSave, wisSave, chaSave

Inside a @@foreach the following values can be referenced:

	itemname, itemstats, itemdetails, damage, spellLevel, spellCastTime, spellRange, spellComponents, spellDuration

## Predefined Functions

Standard functions:

	min(a, b, c, ...), max(a, b, c, ...), abs(x), round(x), trunc(x), floor(x), ceil(x)

concat(s1, delim, s2): concatenates the two strings with delim, omitting delim if either of s1 or s2 is empty.

count(string): number of items of the specified type ('spell', 'class', 'loot', etc.).

striphtml(string): remove all HTML tags from string.

strlength(string): number of characters in string.

sign(number): places a '+' in front of number if greater than zero.


## Operators

### +, -, \*, /
Standard binary arithmetic operators

### \>, \<, ≥, \>=, ≤, \<=, ≠, !=
Standard comparison operators

### &&, ||
Standard logical AND and OR

### !, -, +
Logical not, unary minus and unary plus

### \*
Unary indirection operator. The operand is taken to be a string and used as a property of the character. For example, "\*'ac'" returns the same value as "ac".

### \<condition\> ? \<value1\> : \<value2\>
Ternary conditional operator: if \<condition\> is true, returns \<value1\>, otherwise \<value2\>
