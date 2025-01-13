/**
 */
 
import {SystemObject} from "./systemobject.js";
import {SwadeEncounter} from "../encounter-calc/encounter-calc.js";
 
import {cat, sign, stripjunk} from "./systemobject.js";

export class swadeObject extends SystemObject {

	constructor(filter, actor, title) {
		super(filter, actor, title);
	}
	
	getValue(symbol) {
		switch (symbol) {
		case 'cv':
			let se = new SwadeEncounter();
			let [cv, cvDetails] = se.combatValue(this.actor);
			this.defs['cvDetails'] = cvDetails;
			return cv;
		}
		return super.getValue(symbol);
	}

	_initialize(title) {
		super._initialize(title);
		let a = this.actor;
		

		// this.defs['hp'] = a.system.attributes.hp.value;
	}

	static {
		console.log("swadeObject | loaded.");
	}

}
