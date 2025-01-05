/**
 */
 
import {SystemObject} from "./systemobject.js";
 
import {cat, sign, stripjunk} from "./systemobject.js";

export class fatexObject extends SystemObject {

	 
	constructor(filter, actor, title) {
		super(filter, actor, title);
	}

	_initialize(title) {
		super._initialize(title);
		let a = this.actor;
		this.defs['name'] = a.name;
		this.defs['actorType'] = a.type;
		this.defs['r8'] = 'Legendary';
		this.defs['r7'] = 'Epic';
		this.defs['r6'] = 'Fantastic';
		this.defs['r5'] = 'Superb';
		this.defs['r4'] = 'Great';
		this.defs['r3'] = 'Good';
		this.defs['r2'] = 'Fair';
		this.defs['r1'] = 'Average';
		this.defs['r0'] = 'Mediocre';
		this.defs['r-1'] = 'Poor';
		this.defs['r-2'] = 'Terrible';
		this.defs['r-3'] = 'Catastropic';
		this.defs['r-4'] = 'Horrifying';
	}
	
 }
 