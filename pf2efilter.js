/**
 */
 
import {SystemObject} from "./systemobject.js";
 
import {cat, sign, stripjunk} from "./systemobject.js";

export class pf2eObject extends SystemObject {

	 
	constructor(filter, actor, title) {
		super(filter, actor, title);
	}

	/**
        "damage": {
          "dice": 1,
          "die": "d6",
          "damageType": "piercing",
          "persistent": null,
          "value": ""
        },
        "bonusDamage": {
          "value": 0
        },
        "splashDamage": {
          "value": 0
        },
		
        "damage": {
          "dice": 1,
          "die": "",
          "damageType": "acid",
          "persistent": {
            "faces": 6,
            "number": 1,
            "type": "acid"
          }
        },
		
        "damageRolls": {
          "rd1cm6vxeedqmf09hgts": {
            "damage": "3d8+12",
            "damageType": "piercing"
          },
          "a998e8ylkdbvsfsodml0": {
            "damage": "1d12",
            "damageType": "electricity"
          }
        },
		
	*/
	
	_itemDamage(item) {
		let dmg = '';
		let d = item.system.damage;

		if (d) {
			if (d.dice > 0) {
				if (d.die) {
					dmg = cat(dmg, ', ', `${d.dice}${d.die} ${d.damageType}`);
				} else {
					dmg = `${d.dice} ${d.damageType}`;
				}
			}
			if (d.persistent) {
				dmg = cat(dmg, ', ', `${d.persistent.number}d${d.persistent.faces} persistent ${d.persistent.type}`);
			}
		}

		if (item?.system?.splashDamage?.value) {
			dmg = cat(dmg, ', ', `${item.system.splashDamage.value} ${d.damageType} splash`);
		}

		if ('damageRolls' in item.system) {
			let rolls = '';
			let dr = item.system.damageRolls;
			for (let prop in dr) {
				rolls = cat(rolls, ' plus ', `${dr[prop].damage} ${dr[prop].damageType}`);
			}
			dmg = cat(dmg, ', ', rolls);
		}

		return dmg;
	}
	
	/**
	    "traits": {
          "value": [
            "electricity",
            "magical",
            "reach-15"
          ],
          "rarity": "common",
          "custom": ""
        },
        "weaponType": {
          "value": "melee"
        },
        "attack": {
          "value": ""
        },
        "damageRolls": {
          "rd1cm6vxeedqmf09hgts": {
            "damage": "3d8+12",
            "damageType": "piercing"
          },
          "a998e8ylkdbvsfsodml0": {
            "damage": "1d12",
            "damageType": "electricity"
          }
        },
        "bonus": {
          "value": 27
        },
	*/

	_atkBonus(item) {
		let atkBonus = '';
		if (item?.system?.bonus) {
			atkBonus = cat(atkBonus, ', ', `${sign(this.filter, item.system.bonus.value)}`);
			if (item?.system?.traits?.value) {
				let str = '';
				for (let i = 0; i < item.system.traits.value.length; i++) {
					let t = item.system.traits.value[i];
					let m = t.match(/reach-(.+)$/);
					if (m)
						str = cat(str, ', ', `reach ${m[1]} feet`);
					else
						str = cat(str, ', ', t);
				}
				atkBonus += ' (' + str + ')';
			}
		}
		
		return atkBonus;
	}
	
	getValue(symbol) {
		switch (symbol) {
		case 'damage':
			return this._itemDamage(this.curItem);
		case 'atkbonus':
			return this._atkBonus(this.curItem);
		case 'actions':
			if ('actions' in this.curItem.system) {
				return this.curItem.system.actions.value;
			}
			return 0;
		}
		return super.getValue(symbol);
	}

	_initialize(title) {
		super._initialize(title);
		let a = this.actor;

		this.defs['hp'] = a.system.attributes.hp.value;
		this.defs['speed'] = a.system.attributes.speed.value;
		this.defs['alignment'] = a.system.details.alignment.value;
		this.defs['level'] = a.system.details.level.value;
			
	}
	
 }
 