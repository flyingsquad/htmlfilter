/**
 */
 
import {SystemObject} from "./systemobject.js";
 
import {cat, sign, stripjunk} from "./systemobject.js";

export class DnD5eObject extends SystemObject {

	// Global bonuses.

	gmwak;
	grwak;
	gmsak;
	grsak;
	gsave;
	gskill;
	gspell;
	gcheck;
	prof;
	 
	constructor(filter, actor, title) {
		super(filter, actor, title);
	}

	_getRef(ref) {
		let parts = ref.split(/\./);
		if (parts.length == 3 && parts[0] == 'classes') {
			const c = this.actor.items.filter(it => it.type == 'class' && it.identifier == parts[1]);
			if (c.length > 0)
				return c[0].system[parts[2]];
		} else if (parts.length == 3 && parts[0] == 'scale') {
			const c = this.actor.items.filter(it => it.type == 'class' && it.identifier == parts[1]);
			if (c.length > 0) {
				const adv = c[0].system.advancement.filter(a => a.configuration?.identifier == parts[2]);
				if (adv.length > 0) {
					let a = adv[0];
					// Look for a matching level less than or equal to current level.
					for (let lev = c[0].system.levels; lev > 0; lev--) {
						if (String(lev) in a.configuration.scale) {
							if (a.configuration.type == 'dice') {
								let v = a.configuration.scale[String(lev)];
								if (v.number)
									return `${v.number}d${v.faces}`;
								return `d${v.faces}`;
							} else {
								return v.toString();
							}
						}
					}
				}
			}
		} else {
			let value = super.getValue('system.' + ref);
			if (value !== undefined)
				return value;
		}
		return ref;
	}
	
	
	getValue(symbol) {
		switch (symbol) {
		case 'item':
			return this.curItem;
		case 'itemname':
			return this.curItem?.name;
		case 'itemstats':
			return this.getitemstats(this.curItem);
		case 'itemdetails':
			return stripjunk(this.filter, this.curItem.system?.description?.value);
		case 'damage':
			return this._itemDamage(this.curItem);
		case 'spellLevel':
			if (this.curItem == null || this.curItem.type != 'spell')
				return 'spellLevel';
			let school = CONFIG.DND5E.spellSchools[this.curItem.system.school];
			let ritual = this.curItem.system.components.ritual ? ' (ritual)' : '';
			if (this.curItem.system.level == 0)
				return `${school} cantrip${ritual}`;
			return `${CONFIG.DND5E.spellLevels[this.curItem.system.level]} ${school}${ritual}`;
		case 'spellCastTime':
			let cond = this.curItem.system.activation.condition ? ` (${this.curItem.system.activation.condition})` : '';
			let ccost = this.curItem.system.activation.cost;
			let ct = this.curItem.system.activation.type;

			switch (this.curItem.system.activation.type) {
			case 'reactiondamage':
			case 'reactionmanual':
			case 'reaction':
				ct = 'Reaction';
				return `${ct}${cond}`
			case 'bonus':
				ct = 'Bonus Action';
				return `${ct}${cond}`
			case 'action':
				ct = 'Action';
				break;
			case 'minute':
				ct = 'Minute';
				break;
			}
			return `${ccost} ${ct}${cond}${ccost!=1?'s':''}`;
		case 'spellRange':
			let range = this.curItem.system.range.units;
			if (range == null && this.curItem.system.range.value == null)
				range = `${this.curItem.system.target.value}-${this.curItem.system.target.units} ${this.curItem.system.target.type}`;
			else if (range != 'self' && range != 'touch')
				range = `${this.curItem.system.range.value} ${this.curItem.system.range.units}`;
			return range;
		case 'spellComponents':
			let comp = "";
			if (this.curItem.system.components.vocal)
				comp = cat(comp, ', ', 'V');
			if (this.curItem.system.components.somatic)
				comp = cat(comp, ', ', 'S');
			if (this.curItem.system.components.material)
				comp = cat(comp, ', ', 'M');
			if (this.curItem.system.materials.value)
				comp += ` (${this.curItem.system.materials.value})`;
			return comp;
		case 'spellDuration':
			let dur = '';
			switch (this.curItem.system.duration.units) {
			case 'inst':
				dur = 'Instantaneous';
				break;
			case 'perm':
				dur = 'Permanent';
				break;
			default:
				let plural = this.curItem.system.duration.value != 1 ? 's' : '';
				if (this.curItem.system.components.concentration)
					dur = `Concentration, up to ${this.curItem.system.duration.value} ${this.curItem.system.duration.units}${plural}`;
				else
					dur = `${this.curItem.system.duration.value} ${this.curItem.system.duration.units}${plural}`;
			}
			return dur;
		default:
			let match = symbol.match(/^@([.A-Za-z0-9_]+)/);
			if (match != null) {
				// Process something like @classes.rogue.levels
				return this._getRef(match[1]);
			}
			break;
		}
		return super.getValue(symbol);
	}

	_setsave(a, abil) {
		let bonus = 0;
		let val = a.system.abilities[abil].value;
		if (val < 10)
			bonus = Math.trunc((val - 11) / 2);
		else
			bonus = Math.trunc((val - 10) / 2);
		if (a.system.abilities[abil].proficient)
			bonus += this.prof;
		//bonus = addbonus(bonus, this.gsave);
		this.defs[abil + 'Save'] = bonus;
	}
	
	_setspeed(a) {
		let speed = '';
		const m = a.system.attributes.movement;
		if (m.walk)
			speed = `${m.walk} ${m.units}`;
		if (m.fly)
			speed = cat(speed, ', ', `Fly ${m.fly} ${m.units}${m.hover ? ' (Hover)' : ''}`);
		if (m.swim)
			speed = cat(speed, ', ', `Swim ${m.swim} ${m.units}`);
		if (m.climb)
			speed = cat(speed, ', ', `Climb ${m.climb} ${m.units}`);
		if (m.burrow)
			speed = cat(speed, ', ', `Burrow ${m.burrow} ${m.units}`);
		if (speed == '')
			speed = 'none';
		this.defs['speed'] = speed;
	}

	
	_setac(a) {
		let ac = 10;
		let items = '';
		let base = 10;
		let bonuses = 0;
		let maxdex = null;
		let dexbonus = 0;

		const acbonuses = a.items.filter(it => it.type == 'equipment' && it.system.equipped);
		acbonuses.forEach((e) => {
			e.effects.forEach((eff) => {
				eff.changes.forEach((c) => {
					if (c.key == "system.attributes.ac.bonus") {
						bonuses += Number(c.value);
						items = cat(items, ', ', e.name);
					}
				});
			});
		});
		
		if (a.system.attributes.ac.bonus)
			bonuses += a.system.attributes.ac.bonus;

		switch (a.system.attributes.ac.calc) {
		case 'default':
			const armor = a.items.filter(it => it.type == 'equipment' && it.system.armor.type != undefined && it.system.equipped);
			armor.forEach((e) => {
				switch (e.system.armor.type) {
				case 'medium': 
				case 'heavy': 
				case 'light': 
					base = Math.max(base, e.system.armor.value);
					maxdex = e.system.armor.dex;
					items = cat(items, ', ', e.name);
					break;
				case 'shield':
					bonuses += e.system.armor.value;
					items = cat(items, ', ', e.name);
					break;
				case 'trinket':
					// FIX: rings & cloaks. bonuses are in the effects.
					items = cat(items, ', ', e.name);
					break;
				}
			});
			if (maxdex != null && a.system.abilities.dex.mod > maxdex)
				dexbonus = maxdex;
			else
				dexbonus = a.system.abilities.dex.mod;
			ac = base + dexbonus + bonuses;
			break;
		case 'mage':
			items = cat(items, ', ', 'Mage Armor');
			ac = 13 + a.system.abilities.dex.mod + bonuses;
			break;
		case 'natural':
			items = cat(items, ', ', 'natural armor');
			ac = a.system.attributes.ac.flat;
			break;
		case 'unarmoredMonk':
			items = cat(items, ', ', 'unarmored monk');
			ac = 10 + a.system.abilities.dex.mod + a.system.abilities.wis.mod + bonuses;
			break;
		case 'unarmoredBarb':
			items = cat(items, ', ', 'unarmored barbarian');
			ac = 10 + a.system.abilities.dex.mod + a.system.abilities.con.mod + bonuses;
			break;
		case 'draconic':
			items = cat(items, ', ', 'draconic resistance');
			ac = 13 + a.system.abilities.dex.mod + bonuses;
			break;
		case 'flat':
			this.defs['ac'] = a.system.attributes.ac.flat;
			return;
		}

		// We calculated the AC, but we'll use the value calculated in the actor
		// to be consistent with the character sheet.
		// this.defs['ac'] = ac;
		this.defs['ac'] = a.system.attributes.ac.value;
		this.defs['acdetails'] = items;
	}

	_setTraits(title, traits) {
		if (traits == undefined)
			return;
		let list = '';
		for (let t in traits.selected) {
			let name = traits.selected[t];
			if (name == undefined)
				name = t;
			list = cat(list, ', ', name);
		}
		this.defs[title] = list;
	}
	
	_setSenses(senses) {
		let s = '';
		if (senses.darkvision)
			s = cat(s, ', ', `Darkvision ${senses.darkvision} ${senses.units}`);
		if (senses.blindsight)
			s = cat(s, ', ', `Blindsight ${senses.blindsight} ${senses.units}`);
		if (senses.tremorsense)
			s = cat(s, ', ', `Tremorsense ${senses.tremorsense} ${senses.units}`);
		if (senses.truesight)
			s = cat(s, ', ', `Truesight ${senses.truesight} ${senses.units}`);
		if (senses.special)
			s = cat(s, ', ', `${senses.special} ${senses.units}`);
		if (s != '')
			this.defs['senses'] = s;
	}

	
	_initialize(title) {
		super._initialize(title);
		let a = this.actor;
		// a.getData();

		this.gmwak = a.system?.bonuses?.mwak;
		this.grwak = a.system?.bonuses?.rwak;
		this.gmsak = a.system?.bonuses?.msak;
		this.grsak = a.system?.bonuses?.rsak;
		this.gsave = a.system?.bonuses?.abilities.save;
		this.gskill = a.system?.bonuses?.abilities.skill;
		this.gspell = a.system?.bonuses?.spell.dc;
		this.gcheck = a.system?.bonuses?.abilities.check;

		this.defs['name'] = a.name;
		this.defs['actorType'] = a.type;
		this.defs['size'] = CONFIG.DND5E.actorSizes[a.system?.traits?.size];
		if (a.type == 'character')
			this.charLevel = a.system.details.level;
		else
			this.charLevel = Number(a.system.attributes.hp.formula.replace(/d.*/, ''));
		this.defs['charLevel'] = this.charLevel;

		let spellAbilities = [];

		if (a.type == 'character') {
			this.prof = this.defs['prof'] = Math.floor((a.system.details.level + 7) / 4);

			// Set class list.

			const classes = a.items.filter(it => it.type == 'class');
			let classList = '';
			let charLevel = 0;
			classes.forEach((c) => {
				classList = cat(classList, ', ', c.name + ' ' + c.system.levels);
				charLevel = charLevel + c.system.levels;
				if (c.system.spellcasting.ability) {
					if (spellAbilities.find(abil => abil == c.system?.spellcast?.ability) === undefined)
						spellAbilities.push(c.system.spellcasting.ability);
				}
				switch (c.name) {
				case 'Warlock':
					this.defs['warlockLevel'] = c.system.levels;
					break;
				}
			});
			if (a.system.attributes.spellcasting) {
				// Didn't find a class with spellcasting, but arcane trickster
				// or eldritch knight might have set this.
				if (spellAbilities.find(abil => abil == a.system.attributes.spellcasting) === undefined)
					spellAbilities.push(a.system.attributes.spellcasting);
			}
			this.defs['charLevel'] = charLevel;
			this.defs['classList'] = classList;
			this.defs['xp'] = getProperty(a, 'system.details.xp.value');
			this.defs['nextLevelXP'] = a.system.details.xp.max;
			this.defs['race'] = a.system.details.race;
			this.defs['spellAbilities'] = spellAbilities;
		} else if (a.type == 'npc') {
			const cr = Number(a.system.details.cr);
			this.prof = this.defs['prof'] = Math.max(Math.floor((cr - 1) / 4), 0) + 2;
			this.defs['cr'] = cr;
			
			const t = a.system.details.type;
			const st = t.subtype ? ' (' + t.subtype + ')' : '';
			this.defs['race'] = `${t.value}${st}`;
		} else {
			// Nothing else to do for groups or other actor types.
			return;
		}

		this.defs['alignment'] = a.system.details.alignment;
		['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach( abil => {
			this.defs[abil] = a.system.abilities[abil].value;
			this.defs[abil + 'Mod'] = a.system.abilities[abil].mod;
			this._setsave(a, abil);
		});

		this._setac(a);
		this._setspeed(a);
		this.defs['hp'] = a.system.attributes.hp.max;
		
		let skills = '';
		Object.keys(a.system.skills).forEach((skill) => {
			skills = cat(skills, ', ', this._getskill(a, skill));
		});
		this.defs['skills'] = skills;
		
		let initAbility = a.system.attributes.init.ability;
		if (!initAbility)
			initAbility = 'dex';
		let initiative = Number(a.system.abilities?.[initAbility]?.mod);
		initiative += Number(a.system.attributes.init.bonus);
		initiative += Number(a.flags.dnd5e?.initiativeAlert ? 5 : 0);
		if (a.flags.dnd5e?.initiativeAdv)
			initiative += '*';
		this.defs['initiative'] = initiative;

		// Problem: some of the data (languages, proficiencies, etc.) isn't
		// loaded into actors until the character sheet itself is opened.
		// So when multiple actors are selected and rendered that data doesn't
		// show up. There's a getData function that seems to do it, but that
		// function is not on the actor passed in here.
		// For this reason, we can't do multiple characters at once or
		// directly from the actor tab. It can only run off the open character sheet.

		this._setSenses(a.system.attributes.senses);
		this._setTraits('languages', a.system.traits.languages);
		this._setTraits('damageResistances', a.system.traits.dr);
		this._setTraits('damageImmunities', a.system.traits.di);
		this._setTraits('damageVulnerabilities', a.system.traits.dv);
		this._setTraits('conditionImmunities', a.system.traits.ci);

		this._setTraits('weaponProficiencies', a.system.traits.weaponProf);
		this._setTraits('armorProficiencies', a.system.traits.armorProf);
		this._setTraits('toolProficiencies', a.system.traits.toolProf);
		if (spellAbilities.length > 0)
			 this._setSpellDC(a, spellAbilities);
		 
		 let background = a.items.filter((b) => b.type == 'background');
		 if (background.length > 0)
			 this.defs['background'] = background[0].name;
		 else
			 this.defs['background'] = '';
	}
	
	_setSpellDC(a, spellAbilities) {
		let mod = 0;
		let data = '';
		let n = 0;
		if (spellAbilities.length > 1) {
			for (let abil of spellAbilities) {
				if (abil != a.system.attributes.spellcasting) {
					switch (abil) {
					case 'int':
						mod = a.system.abilities.int.mod;
						break;
					case 'wis':
						mod = a.system.abilities.wis.mod;
						break;
					case 'cha':
						mod = a.system.abilities.cha.mod;
						break;
					}
				}
				data = cat(data, '; ', `${CONFIG.DND5E.abilities[abil]} Spell DC ${8+this.prof+_addbonus(mod, this.gspell)}, Spell Attack ${sign(0, mod+this.prof)}`);
				this.defs[abil + 'msak'] = sign(this, mod + this.prof + Number(this.gmsak?.attack));
				this.defs[abil + 'rsak'] = sign(this, mod + this.prof + Number(this.grsak?.attack));
				this.defs[abil + 'spelldc'] = 8 + this.prof+_addbonus(mod, this.gspell);
				if (n++ == 0) {
					this.defs['rsak'] = sign(this, mod + this.prof + Number(this.grsak?.attack));
					this.defs['msak'] = sign(this, mod + this.prof + Number(this.gmsak?.attack));
					this.defs['spelldc'] = 8 + this.prof+_addbonus(mod, this.gspell);
				}
			}
		} else {
			switch (a.system.attributes.spellcasting) {
			case 'wis':
				mod = a.system.abilities.wis.mod;
				break;
			case 'int':
				mod = a.system.abilities.int.mod;
				break;
			case 'cha':
				mod = a.system.abilities.cha.mod;
				break;
			}
			data = `Spell DC ${8+this.prof+_addbonus(mod, this.gspell)}, Spell Attack ${sign(0, mod+this.prof)}`;

			this.defs[a.system.attributes.spellcasting + 'msak'] =
				this.defs['msak'] = sign(this, mod + this.prof + Number(this.gmsak?.attack));
			this.defs[a.system.attributes.spellcasting + 'rsak'] =
				this.defs['rsak'] = sign(this, mod + this.prof + Number(this.grsak?.attack));
			this.defs[a.system.attributes.spellcasting + 'spelldc'] =
				this.defs['spelldc'] = 8 + this.prof+_addbonus(mod, this.gspell);
		}
		this.defs['spellcasting'] = data;
	}
	
	/**	Replace any @ refs in the text.
	 */
	replaceRefs(str, mod) {
		let result = '';
		let matches = str.matchAll(/@([-.a-zA-Z]+)/g);
		let i = 0;
		for (const match of matches) {
			if (match.index > 0)
				result += str.substring(0, match.index);
			i = match.index + match[0].length;
			switch (match[1]) {
			case 'mod':
				result += mod.toString();
				break;
			default:
				if (/\./.test(match[1])) {
					result += this._getRef(match[1]);
				} else {
					result += match[1];
				}
				break;
			}
		}
		if (i > 0) {
			// Replacements occurred.
			if (i < str.length)
				result += str.substring(i);
			return result;
		}
		// No replacements happened. Return original value.
		return str;
	}

	getDamage(dmg, mod) {
		var total = 0;
		dmg = this.replaceRefs(dmg, mod);
		let s = dmg.replace(/\s/g, '');
		s = s.match(/[+\-]?([^+\-]+)/g) || [];
		let dice = '';
		while (s.length) {
			let v = s.shift();
			if (v.search(/[^0-9\-+]/) >= 0)
				dice += v;
			else
				total += Number(v);
		}
		if (total)
			return `${dice}${sign(this.filter, total)}`;
		return dice;
	}
	
	getitemstats(item) {
		switch (item?.type) {
		case undefined:
			return 'undefined';
		case 'weapon':
			return this._weaponStats(item);
		}
		return this._genericStats(item);
	}

	_itemDamage(i) {
		if (!i)
			return '';
		let damage = '';
		i.system.damage.parts.forEach((d) => {
			let dmg = this.getDamage(d[0], 0);
			let evaluated = '';
			if (dmg)
				evaluated = this.filter.evalexp(dmg);
			if (evaluated !== undefined && !isNaN(evaluated))
				dmg = evaluated;
			damage = cat(damage, ', plus ', `${dmg} ${d[1]}`);
		});
		return damage;
	}

	_genericStats(i) {
		let deets = '';
		if (i.system.actionType == 'msak') {
			deets = `Melee: ${this.defs['msak']} to hit`;
		} else if (i.system.actionType == 'rsak') {
			deets = `Ranged: ${this.defs['rsak']} to hit`;
		} else if (i.system.actionType == 'save' && i.system?.save?.ability) {
			deets = `Save: ${CONFIG.DND5E.abilities[i.system.save.ability].label} DC ${this.defs['spelldc']}`;
		}

		if (i.system.quantity != 1 && i.system.quantity != undefined)
			deets = cat(deets, ', ', `&times;${i.system.quantity}`);
		if (i.system.armor != undefined && i.system.armor.value > 0) {
			deets = cat(deets, ', ', `AC ${i.system.armor.value}`);
			if (i.system.armor.type)
				deets = cat(deets, ', ', i.system.armor.type);
			if (i.system.armor.dex != undefined)
				deets = cat(deets, ', ', `Max Dex ${i.system.armor.dex}`);
		}
		if (i.system.activation != undefined && i.system.activation.type) {
			let activation = i.system.activation;
			if (activation.type == 'reaction')
				deets = cat(deets, ', ', activation.type);
			else if (activation.type != 'action' &&  activation.type != 'special')
				deets = cat(deets, ', ', `${activation.cost != 1 && activation.cost != null ? activation.cost + ' ' : ''}${activation.type} action${activation.cost != 1 && activation.cost != null ? 's' : ''}`);
		}
		
		if (i.system.uses != undefined && i.system.uses.value != null) {
			const u = i.system.uses;
			if (u.max > 0) {
				let per = u.per;
				if (per == 'charges') {
					if (u.max != 1)
						deets = cat(deets, ', ', `${u.max} charge${u.max!=1?'s':''}`);
				} else {
					switch (per) {
					case 'lr': per = 'long rest'; break;
					case 'sr': per = 'short rest'; break;
					}
					deets = cat(deets, ', ', `uses: ${u.max} per ${per}`);
				}
			}
		}
		let damage = '';
		if (i.system.damage) {
			i.system.damage.parts.forEach((d) => {
				let scaling;
				let dmg = this.getDamage(d[0], 0);
				let evaluated = '';
				if (dmg)
					evaluated = this.filter.evalexp(dmg);
				if (evaluated !== undefined && !isNaN(evaluated))
					dmg = evaluated;
				if (i.system?.scaling?.mode == 'cantrip') {
					let cantripDmg = 1 + Math.trunc((this.charLevel + 1) / 6);
					dmg = dmg.replace(/^1d/i, cantripDmg.toString() + 'd'); 
				}
				if (d[1] === 'temphp')
					d[1] = 'temporary healing';
				damage = cat(damage, ', plus ', `${dmg} ${d[1]}`);
			});
		}
		if (damage) {
			deets = cat(deets, ', ', damage);
			if (damage.search(/healing/i) < 0)
				deets += ' damage';
		}
		
		if (i.system.formula) {
			let formula = this.replaceRefs(i.system.formula, 0);
			let result = this.filter.evalexp(formula);
			if (result === undefined)
				result = formula;
			if (i.system.chatFlavor) {
				deets = cat(deets, ', ', `${i.system.chatFlavor} ${result}`);
			} else {
				deets = cat(deets, ', ', result);
			}
		}
		if (i.system?.duration?.value)
			deets = cat(deets, ', ', `Duration: ${i.system.duration.value} ${i.system.duration.units}${i.system.duration.value!=1?'s':''}`);
		if (i.system?.target?.value)
			deets = cat(deets, ', ', `${i.system.target.value} ${i.system.target.units} ${i.system.target.type}`);
		if (i.system?.price?.value)
			deets = cat(deets, ', ', `${i.system.price.value}${i.system.price?.denomination}`);
		if (i.system?.weight)
			deets = cat(deets, ', ', `Weight: ${i.system.weight}`);
		return deets;
	}
	
	_weaponStats(w) {
		let a = this.actor;
		// Greataxe. Melee Weapon Attack: +5 to hit, reach 5 ft., one target. Hit: (1d12 + 3) slashing damage.
		let weapdeets = '';
		if (w.system?.activation.type == 'legendary') {
			weapdeets = `${w.system.activation.cost} Legendary Action${w.system.activation.cost!=1 ? 's' : ''}`;
		}
		let mod = 0;
		let range = '';
		switch (w.system.actionType) {
		case 'mwak':
		case '':
			weapdeets = cat(weapdeets, ', ', 'Melee: ');
			if (w.system.properties.fin)
				mod = Math.max(a.system.abilities.str.mod, a.system.abilities.dex.mod);
			else
				mod = a.system.abilities.str.mod;
			if (w.system.properties.thr) {
				if (w.system.range.long)
					range = `reach 5 ft or range ${w.system.range.value}/${w.system.range.long} ${w.system.range.units}`;
				else
					range = `reach 5 ft or range ${w.system.range.value} ${w.system.range.units}`;
			} else if (w.system.range.value != null && w.system.range.units != null )
				range = `reach ${w.system.range.value} ${w.system.range.units}`;
			break;
		case 'rwak':
			weapdeets = cat(weapdeets, ', ', 'Ranged: ');
			mod = a.system.abilities.dex.mod;
			if (w.system.range.long)
				range = `range ${w.system.range.value}/${w.system.range.long} ${w.system.range.units}`;
			else
				range = `range ${w.system.range.value} ${w.system.range.units}`;
			break;
		}

		function proficiencyMultiplier(actor, sys) {
			if ( Number.isFinite(sys.proficient) )
				return sys.proficient;
			if ( actor.type === "npc" ) return 1; // NPCs are always considered proficient with any weapon in their stat block.
			const config = CONFIG.DND5E.weaponProficienciesMap;
			const itemProf = config[sys.weaponType];
			const actorProfs = actor.system.traits?.weaponProf?.value ?? new Set();
			const natural = sys.weaponType === "natural";
			const improvised = (sys.weaponType === "improv") && !!actor.getFlag("dnd5e", "tavernBrawlerFeat");
			const isProficient = natural || improvised || actorProfs.has(itemProf) || actorProfs.has(sys.baseItem);
			return Number(isProficient);
		}

		let prof = proficiencyMultiplier(a, w.system) ? this.defs['prof'] : 0;
			
		let tohit = Number(w.system.attackBonus) + mod + prof;
		weapdeets += sign(this.filter, tohit) + ` to hit`;
		if (range)
			weapdeets += `, ${range}`;
		
		let damage = '';
		w.system.damage.parts.forEach((d) => {
			let dmg = this.getDamage(d[0], mod);
			damage = cat(damage, ', plus ', `${dmg} ${d[1]}`);
		});
		if (damage)
			weapdeets += `. Hit: ${damage}`;
		if (w.system?.save.ability) {
			weapdeets += `, DC ${w.system.save.dc} ${CONFIG.DND5E.abilityAbbreviations[w.system.save.ability]} saving throw`;
		}
		let props = '';
		if (w.system.properties.fin) props = cat(props, ', ', 'Finesse');
		if (w.system.properties.lgt) props = cat(props, ', ', 'Light');
		if (w.system.properties.thr) props = cat(props, ', ', 'Thrown');
		if (w.system.damage.versatile) {
			props = cat(props, ', ', `Versatile ${this.getDamage(w.system.damage.versatile, mod)}`);
		}
		if (props != '')
			weapdeets += ` (${props})`;
		return weapdeets;
	}

	_getskill(a, skill) {
		let prof = this.defs['prof'];
		let s = CONFIG.DND5E.skills[skill].label;
		// skills = cat(skills, ', ', skill);
		let sval = a.system.skills[skill].value;
		let abil = a.system.skills[skill].ability;
		let amod = a.system.abilities[abil].mod;
		let value = amod;
		value += Math.floor(prof * sval);
		value = _addbonus(value, this.gskill);
		value = _addbonus(value, this.gcheck);
		this.defs[skill] = sign(this.filter, value);
		if (value == amod)
			return '';
		return s + ' ' + sign(this.filter, value);
	}

 }
 
 function _addbonus(value, b) {
	switch (typeof b) {
	case 'number':
		if (Number(value))
			return value + b;
		return `${value} + ${b}`;
	case 'string':
		if (b.search(/[^0-9]/) >= 0)
			return `${value} + ${b}`;
		if (b)
			return value + Number(b);
		return value;
	}
	return value;
}
