/**	Replace references to an actor in a source HTML file and
 *	place the resulting file in a browswer tab.
 */
 
import {DnD5eObject} from "./dnd5efilter.js";
import {pf2eObject} from "./pf2efilter.js";
import {SystemObject} from "./systemobject.js";

const EOX = '';
const NUMBER = 'number';
const STRING = 'string';
const SYMBOL = 'symbol';
const PLUS = '+';
const MINUS = '-';
const MULTIPLY = '*';
const DIVIDE = '/';
const EQ = '=';
const NEQ = '≠';
const LEQ = '≤';
const GEQ = '≥';
const AND = '&';
const OR = '|';
const QUESTION = '?';
const COLON = ':';
const LPAREN = '(';
const RPAREN = ')';
const COMMA = ',';
const NOT = '!';
const LT = '<';
const GT = '>';
const OPERATOR = 'operator';
const FUNCTION = 'function';
const INDIRECTION = 'unary*';
const UNARYMINUS = 'unary-';

function last(array) {
	return array[array.length - 1];
}

function opPri(token) {
	switch (token.op) {
	case EOX:
		return 0;
	case PLUS:
	case MINUS:
		return 50;
	case MULTIPLY:
	case DIVIDE:
		return 60;
	case LT:
	case GT:
	case EQ:
	case NEQ:
	case LEQ:
	case GEQ:
		return 40;
	case AND:
	case OR:
		return 30;
	case QUESTION:
	case COLON:
		return 20;
	case LPAREN:
		return 5;
	case RPAREN:
		return 5;
	case COMMA:
		return 10;
	case INDIRECTION:
	case UNARYMINUS:
	case NOT:
		return 80;
	case FUNCTION:
		return 90;
	}
	throw `Unknown operator: ${token.op}`;
}

export function htmlEscape(str) {
	// Make this better.
	return str
		.replace(/&/g, '&amp')
		.replace(/'/g, '&apos')
		.replace(/"/g, '&quot')
		.replace(/>/g, '&gt')   
		.replace(/</g, '&lt');    
}


export class HTMLFilter {

	// this variables used in the object.

	tab;		// Window (tab) that displays the output.
	actor;		// Actor object.
	title;		// Title (name or world).
	pattern;	// HTML document read from the filters folder that is the pattern.
	header;		// Header of HTML file (before <body>).
	body;		// Body of file (between <body> and </body>).
	footer;		// Footer of file (after </body>).
	defs;		// Special definitions like title.
	functions;	// Functions that can be called in @{} references.
	systemObject; // Object that gets data out of the character.
	macros;		// Defined macros.	

	write(string) {
		this.tab.document.write(string);
	}

	getToken(expression) {
		let i = expression.index;
		for (;;) {
			if (i >= expression.str.length)
				return {type: OPERATOR, op: EOX};
			if (!/\s/.test(expression.str[i]))
				break;
			i++;
		}

		let ch = expression.str[i++];

		if (/[_A-Za-z@]/.test(ch)) {
			let symbol = ch;
			while (i < expression.str.length) {
				ch = expression.str[i];
				if (!/[_0-9A-Za-z.]/.test(ch))
					break;
				symbol += ch;
				i++;
			}
			expression.index = i;
			let f = this.functions[symbol];
			if (f !== undefined)
				return {type: OPERATOR, op: FUNCTION, func: f};
			return {type: SYMBOL, value: symbol};
		}
		
		if (/[0-9.]/.test(ch)) {
			let number = ch;
			while (i < expression.str.length) {
				ch = expression.str[i];
				if (!/[0-9.]/.test(ch))
					break;
				number += ch;
				i++;
			}
			expression.index = i;
			return {type: NUMBER, value: Number(number)};
		}
		
		if (/^['"]/.test(ch)) {
			// String constant.
			let quote = ch;
			let string = '';

			while (i < expression.str.length) {
				ch = expression.str[i++];
				if (ch == quote)
					break;
				if (i >= expression.str.length)
					break;
				if (ch == '\\')
					ch = expression.str[i++];
				string += ch;
			}
			expression.index = i;
			return {type: STRING, value: string};
		}

		let op = {type: OPERATOR, op: EOX};

		switch (ch) {
		case '&':
			ch = expression.str[i];
			if (ch == '&')
				i++;
			op.op = AND;
			break;
		case '|':
			ch = expression.str[i];
			if (ch == '|')
				i++;
			op.op = OR;
			break;
		case '!':
			ch = expression.str[i];
			if (ch == '=') {
				i++;
				op.op = NEQ;
			} else
				op.op = NOT;
			break;
		case '<':
			ch = expression.str[i];
			if (ch == '=') {
				op.op = LEQ;
				i++;
			} else
				op.op = LT;
			break;
		case '>':
			ch = expression.str[i];
			if (ch == '=') {
				i++;
				op.op = GEQ;
			} else
				op.op = GT;
			break;
		case '≠':
			op.op = NEQ;
			break;
		case '≤':
			op.op = LEQ;
			break
		case '≥':
			op.op = GEQ;
			break;
		case '(':
			op.op = LPAREN;
			break;
		case ')':
			op.op = RPAREN;
			break;
		case ',':
			op.op = COMMA;
			break;
		case '+':
			op.op = PLUS;
			break;
		case '-':
			op.op = MINUS;
			break;
		case '*':
			op.op = MULTIPLY;
			break;
		case '/':
			op.op = DIVIDE;
			break;
		case '=':
			op.op = EQ;
			break;
		case '?':
			op.op = QUESTION;
			break;
		case ':':
			op.op = COLON;
			break;
		default:
			throw `Bad expression: unknown operator "${ch}" (${expression.str})`;
			break;
		}
		expression.index = i;
		return op;
	}
	
	getOperandValue(operand) {
		switch (operand.type) {
		case STRING:
		case NUMBER:
			return operand.value;
		case SYMBOL:
			return this.resolve(operand.value);
		}
	}
	
	doOp(operator, operands) {
		let a;
		let b;
		let c;

		switch (operator.op) {
		case INDIRECTION:
			// "Indirection": look up the symbol referenced by a string.
			operands.push(this.resolve(operands.pop()));
			break;
		case UNARYMINUS:
			operands.push(-operands.pop());
			break;
		case PLUS:
			a = operands.pop();
			b = operands.pop();
			operands.push(b + a);
			break;
		case MINUS:
			a = operands.pop();
			b = operands.pop();
			operands.push(b - a);
			break;
		case MULTIPLY:
			a = operands.pop();
			b = operands.pop();
			operands.push(b * a);
			break;
		case DIVIDE:
			a = operands.pop();
			b = operands.pop();
			operands.push(b / a);
			break;
		case NOT:
			operands.push(!operands.pop());
			break;
		case NEQ:
			a = operands.pop();
			b = operands.pop();
			operands.push(b != a);
			break;
		case GEQ:
			a = operands.pop();
			b = operands.pop();
			operands.push(b >= a);
			break;
		case LEQ:
			a = operands.pop();
			b = operands.pop();
			operands.push(b <= a);
			break;
		case EQ:
			a = operands.pop();
			b = operands.pop();
			operands.push(b == a);
			break;
		case LT:
			a = operands.pop();
			b = operands.pop();
			operands.push(b < a);
			break;
		case GT:
			a = operands.pop();
			b = operands.pop();
			operands.push(b > a);
			break;
		case AND:
			a = operands.pop();
			b = operands.pop();
			operands.push(b && a);
			break;
		case OR:
			a = operands.pop();
			b = operands.pop();
			operands.push(b || a);
			break;
		case LPAREN: case RPAREN:
			// Do-nothings at this point.
			break;
		case COLON:
			a = operands.pop();
			b = operands.pop();
			c = operands.pop();
			operands.push(c ? b : a);
			break;
		case FUNCTION:
			operands.push(operator.func(operands.pop()));
			break
		}
	}


	unaryOp(operators, token) {
		switch (token.op) {
		case MULTIPLY:
			operators.push({type: OPERATOR, op: INDIRECTION});
			break;
		case MINUS:
			operators.push({type: OPERATOR, op: UNARYMINUS});
			break;
		case PLUS:
			// Ignore unary plus.
			break;
		default:
			throw `Bad expression: ${token.op}`;
			break;
		}
	}	

	rparen(operators, operands) {
		let rparenPri = opPri({type: OPERATOR, op: RPAREN});
		let lastOp;

		for (;;) {
			lastOp = last(operators).op;
			if (lastOp == LPAREN || lastOp == COMMA)
				break;
			while (opPri(last(operators)) > rparenPri) {
				if (last(operators).op == COMMA)
					break;
				let operator = operators.pop();
				if (operator == COLON) {
					if (operators.pop() != QUESTION)
						throw "Missing ? operator";
				}
				this.doOp(operator, operands);
			}
		}

		if (lastOp == LPAREN) {
			// Look for single-argument function and execute
			// if found. Otherwise it's just a complete
			// parenthesized subexpression.
			operators.pop();
			if (operators.length == 0)
				return;
			let operator  = last(operators);
			if (operator.op == FUNCTION) {
				operators.pop();
				let result = operator.func(this.systemObject, operands.pop());
				operands.push(result);
			}
			return;
		}
		
		// Operator stack should have commas and then a paren, then
		// a function to call.
		// Unstack arguments and pass them to the function.

		if (lastOp != COMMA)
			throw `Invalid expression`;
		let args = [];
		for (;;) {
			lastOp = operators.pop().op;
			args.unshift(operands.pop());
			if (lastOp == LPAREN)
				break;
			if (lastOp != COMMA)
				throw 'Invalid expression';
		}
		
		if (operators.length == 0)
			throw 'Invalid expression';
		let f = operators.pop();
		if (f.op != FUNCTION)
			throw 'Arguments found without function';
		args.unshift(this.systemObject);
		let result = f.func(...args);
		operands.push(result);
	}

	evalexp(exp) {
		let operands = [];
		let operators = [];
		
		let prevop = true;
		
		let expression = {str: exp, index: 0};
		
		try {
			let token;
			for (;;) {
				token = this.getToken(expression);
				
				if (token.type == OPERATOR) {
					switch (token.op) {
					case NOT:
					case LPAREN:
					case FUNCTION:
						operators.push(token);
						prevop = true;
						break;
					case RPAREN:
						this.rparen(operators, operands);
						prevop = false;
						break;
					default:
						if (prevop) {
							this.unaryOp(operators, token);
						} else {
							while (operators.length > 0 && opPri(token) <= opPri(last(operators))) {
								if (token.op == COMMA && last(operators).op == COMMA)
									break;
								let operator = operators.pop();
								if (operator == COLON) {
									if (operators.pop() != QUESTION)
										throw "Missing ? operator";
								}
								this.doOp(operator, operands);
							}
							operators.push(token);
							prevop = true;
						}
					}
				} else {
					switch (token.type) {
					case SYMBOL:
						operands.push(this.resolve(token.value));
						break;
					default:
						operands.push(token.value);
						break;
					}
					prevop = false;
				}
				if (token.type == OPERATOR && token.op == EOX)
					break;
			}

		} catch (msg) {
			return `${msg} (${exp})`;
		}

		if (operands.length <= 0)
			return 0;
		if (operands.length > 1)
			;
		return operands.pop();
	}

	setTitle(title) {
		if (!this.tab) {
			console.log('htmlfilter | no tab to write into.');
			return false;
		}

		this.defs = [];
		this.defs['title'] = title;
		this.macros = [];
		
		this.process(this.header);

		return true;
	}
	
	finish() {
		if (!this.tab) {
			console.log('htmlfilter | no tab to write into.');
			return;
		}
		this.process(this.footer);
		this.tab.document.close();
	}
	
	async createtab() {
		let filterURL = game.settings.get('htmlfilter', 'filter');

		// filterURL.searchParams.set();
		let response = await fetch(filterURL);
		if (!response.ok) {
			ui.notifications.warn(`Unable to read filter file ${filterURL}`);
			return false;
		}
	
		this.pattern = await response.text();
		
		this.tab = window.open('about:blank', '_blank');
		if (!this.tab) {
			ui.notifications.warn('Unable to open tab in browser');
			return false;
		}
		
		let bodypat = /<body[^a-z]*>/i;
		let match = this.pattern.match(bodypat);
		if (match.length != 1) {
			ui.notifications.warn('HTML file bad format: <body> missing.');
			return false;
		}
		let lastIndex = match.index + match[0].length;
		this.header = this.pattern.substring(0, lastIndex);
		
		let footerStart = this.pattern.search(/<\/body>/i);
		if (footerStart < 0) {
			ui.notifications.warn('HTML file bad format: </body> missing.');
			return false;
		}

		this.footer = this.pattern.substring(footerStart);
		
		this.body = this.pattern.substring(lastIndex, footerStart);
		
		let ignore = game.settings.get('htmlfilter', 'ignore');
		this.ignoredItems = new Set(ignore.split(/ *; */))

		return true;
	}
	
	
	/**	Handle reference to actor object member of the form
	 *	system.abilities.str.value. Return undefined if
	 *	it doesn't exist or doesn't resolves to
	 *	a number or string.
	 */
	
	resolve(ref) {
		let functionCall = ref.match(/([A-Za-z0-9]+)\((.+)\) *$/);
		if (functionCall && functionCall.length == 3) {
			let v = this.resolve(functionCall[2]);
			if (v === undefined)
				return undefined;
			let f = this.functions[functionCall[1]];
			if (f === undefined)
				return undefined;
			return f(this, v);
		}

		if (this.systemObject) {
			let value = this.systemObject.getValue(ref);
			if (value !== undefined)
				return value;
		}
		let value = this.defs[ref];
		if (value !== undefined)
			return value;
		
		let parts = ref.split('.');

		let object;
		if (parts[0] == 'item') {
			object = this.systemObject.getCurItem();
			parts.shift();
		} else
			object = this.actor;

		for (let i = 0; i < parts.length; i++) {
			object = object[parts[i]];
			if (object === undefined)
				return undefined;
		}
		if (typeof object != 'number' && typeof object != 'string')
			return undefined;
		return object;
	}
	

	/**	Replaces references to actor data with values.
	 */

	process(string) {
		const regexp = /@\{(?<ref>[^}]+)\}/g;
		const matches = string.matchAll(regexp);

		let i = 0;
		for (const match of matches) {
			this.write(string.substring(i, match.index));
			i = match.index + match[0].length;
			let value;
			let t = match.groups.ref.trim();
			if (/[^._A-Za-z]/.test(t))
				value = this.evalexp(t);
			else
				value = this.resolve(t);
			if (value !== undefined)
				this.write(value);
			else
				this.write(htmlEscape(match[0]));
		}

		if (i > 0) {
			// Processing took place.
			if (i < string.length)
				this.write(string.substring(i));
		} else {
			this.write(string);
		}
	}
	
	isTrue(exp) {
		return this.evalexp(exp);
	}
	
	doForeach(argument, source) {
		let items = this.systemObject.getItemList(argument);	
		if (items === undefined)
			return;

		let saveItem = this.systemObject.getCurItem();

		items.forEach((item) => {
			this.systemObject.setCurItem(item);
			this.directives(source);
		});
		
		this.systemObject.setCurItem(saveItem);
	}
	
	doDefine(argument) {
		let valname;
		let value;
		[valname, value] = argument.split(/ *= */);
		this.systemObject.define(valname, this.evalexp(value));
	}

	doFor(argument, source) {
		/* <!--@for(i = 0; i < count_spell; i = i + 1) */
		let init;
		let test;
		let inc;
		[init, test, inc] = argument.split(/ *; */);
		if (!init) throw "Missing initialization in for (${argument})";
		if (!test) throw "Missing test in for (${argument})";
		if (!inc) throw "Missing increment in for (${argument})";

		let varname;
		let startval;
		[varname, startval] = init.split(/ *= */);
		let saveVar = this.defs[varname];
		this.defs[varname] = this.evalexp(startval);
		
		let incvar;
		let nextval;
		[incvar, nextval] = inc.split(/ *= */);
		if (incvar != varname)
			throw `Mismatched variables in for (${varname} and ${incvar})`;
		
		// Prevent an infinite loop by imposing a maximum repeat of 1000.

		for (let loopCheck = 0; loopCheck < 1000; loopCheck++) {
			let result = this.evalexp(test);
			if (!result)
				break;
			this.directives(source);
			result = this.evalexp(nextval);
			this.defs[varname] = result;
		}
		
		this.defs[varname] = saveVar;
	}
	
	defineMacro(argument, enclosedText) {
		let match = argument.match(/([A-Za-z_][A-Za-z_0-9]*) *\((.*)\)/);
		if (!match || match.length != 3)
			throw `Malformed macro definition: ${argument}`;
		const name = match[1];
		const argumentList = match[2].split(/ *, */);
		
		let macro = [];
		macro['argList'] = argumentList;
		macro['body'] = enclosedText;
		
		this.macros[name] = macro;
	}
	
	callMacro(argument) {
		let match = argument.match(/([A-Za-z_][A-Za-z_0-9]*) *\((.*)\)/);
		if (!match || match.length != 3)
			throw `Incorrect macro call: ${argument}`;
		let name = match[1];
		let argumentList = match[2].split(/ *, */);
		
		let macro = this.macros[name];
		if (!macro)
			throw `Call to undefined macro: ${argument}`;
			
		let body = macro.body;
		
		// Replace arguments in the body of the macro.

		for (let i = 0; i < argumentList.length; i++) {
			if (i < macro.argList.length)
				body = body.replaceAll(macro.argList[i], argumentList[i]);
		}
		this.directives(body);
	}

	/**	Search for @@xx{} directives and execute them.
	 */
	directives(source) {
		for (;;) {
			let match = source.match(/@@([a-z]+)(\{([^}]+)\})?/);
			if (match == null) {
				// No more directives. Process rest of text. Ignore white space.
				this.process(source.trimStart());
				break;
			}
			
			if (match.index > 0) {
				// Process everything between start of string and 
				// beginning of directive. Ignore space.
				let nonspace = Math.max(0, source.search(/\S/));
				if (match.index > nonspace)
					this.process(source.substring(nonspace, match.index));
			}
			source = source.substring(match.index + match[0].length);

			let directive = match[1];
			let argument = match[3];
			
			if (directive == 'define') {
				this.doDefine(argument);
			} else if (directive == 'call') {
				this.callMacro(argument);
			} else {
				// Get location of corresponding end directive.
				let [endIndex, postEnd] = this.findEnd(source, directive);
				let enclosedText = source.substring(0, endIndex);
				
				source = source.substring(postEnd);

				switch (directive) {
				case 'if':
					if (this.isTrue(argument))
						this.directives(enclosedText);
					break;
				case 'foreach':
					this.doForeach(argument, enclosedText);
					break;
				case 'for':
					this.doFor(argument, enclosedText);
					break;
				case 'macro':
					this.defineMacro(argument, enclosedText);
					break;
				case 'endif':
					throw "Unmatched @@endif";
				default:
					throw `Unknown directive: ${directive}`;
				}
			}
		}
	}

	endlessDirectives = ['call', 'define'];

	/**	Return index of start of corresponding @@end
	 */
	findEnd(source, directive) {
		let pat = /@@([a-z]+)(\{[^}]+\})?/g;
		const matches = source.matchAll(pat);

		let nesting = 0;

		for (const match of matches) {
			if (/^end/.test(match[1])) {
				if (nesting <= 0) {
					if (match[1] == 'end' || match[1] == 'end' + directive)
						return [match.index, match.index + match[0].length];
					throw `Expected end or end${directive} to close ${directive} directive`;
				}
				nesting--;
			} else if (this.endlessDirectives.indexOf(match[1]) < 0)
				nesting++;
		}
		// Found nothing. End of text is the end.
		return [source.length, source.length];
	}

	filter(actor) {
		if (!this.tab) {
			console.log('htmlfilter | no tab to write into.');
			return;
		}
		this.actor = actor;

		switch (game.system.id) {
		case 'dnd5e':
			this.systemObject = new DnD5eObject(this, actor, this.title);
			break;
		case 'pf2e':
			this.systemObject = new pf2eObject(this, actor, this.title);
			break;
		default:
			this.systemObject = new SystemObject(this, actor, this.title);
			break;
		}

		this.directives(this.body);
	}

	static {

	}
}

/**
 * These hooks can't be set because some data (full names of languages, proficiencies) aren't
 * loaded until the character sheet is opened. To avoid replicating all that code here,
 * only allow characters to be filtered from the character sheet title bar.
*/

Hooks.on("getActorDirectoryEntryContext", (html, entries) => {
	entries.push({
		name: "Print Character Sheet",
		icon: '<i class="fas fa-file-text"></i>',
		condition: li => {
			const actor = game.actors.get(li.data("documentId"));
			const canExport = actor.isOwner || game.user.isGM;
			return canExport;
		},
		callback: async (li) => {
			let f;
			try {
				const actor = game.actors.get(li.data("documentId"));
				f = new HTMLFilter();

				if (!await f.createtab())
					return false;

				f.setTitle(actor.name);
				f.filter(actor);
			} catch (msg) {
				ui.notifications.warn(msg);
			} finally {
				if (f)
					f.finish();
			}

		}
	});
});

Hooks.on("renderActorDirectory", (app, html, data) => {

    const filterButton = $("<button id='htmlfilter-button'><i class='fas fa-file-text'></i></i>Print Character Sheet</button>");
    html.find(".directory-footer").append(filterButton);

    filterButton.click(async (ev) => {
		let tokens = canvas.tokens.controlled;
		if (tokens.length > 0) {
			let f;
			try {
				tokens.sort(function(a, b) { return a.actor.name < b.actor.name ? -1 : 1; });
				f = new HTMLFilter();

				if (!await f.createtab())
					return false;

				let name;
				if (tokens.length == 1)
					name = tokens[0].actor.name;
				else
					name = game.world.title;

				f.setTitle(name);

				for (let token of tokens) {
					let a = token.actor;
					a.prepareBaseData();
					a.prepareData();
					a.prepareDerivedData();
					//a.prepareEmbeddedDocuments();
					f.filter(a);
				}
			} catch (msg) {
				ui.notifications.warn(msg);
			} finally {
				if (f)
					f.finish();
			}
			
		} else {
			ui.notifications.warn("No Tokens were selected");
		}

    });
});

/*
 * Create the configuration settings.
 */
Hooks.once('init', async function () {
	let defFilter = 'modules/htmlfilter/filters/' + game.system.id + '.txt';
	game.settings.register('htmlfilter', 'filter', {
	  name: 'Filter file',
	  hint: 'Name of filter file. Must be placed in data/htmlfilter/filters folder.',
	  scope: 'client',     // "world" = sync to db, "client" = local storage
	  config: true,       // false if you dont want it to show in module config
	  type: String,       // Number, Boolean, String, Object
	  default: defFilter,
	  filePicker: true,
	});
	game.settings.register('htmlfilter', 'details', {
	  name: 'Show Long Descriptions',
	  hint: 'Shows the long descriptions for items.',
	  scope: 'client',     // "world" = sync to db, "client" = local storage
	  config: true,       // false if you dont want it to show in module config
	  type: Boolean,       // Number, Boolean, String, Object
	  default: false,
	});
	game.settings.register('htmlfilter', 'maxdetails', {
	  name: 'Maximum Detail Length',
	  hint: 'If the details of an item exceed this length, the details will not be displayed. This is for items such as race, which are very long and filled with information included in other items.',
	  scope: 'client',     // "world" = sync to db, "client" = local storage
	  config: true,       // false if you dont want it to show in module config
	  type: Number,       // Number, Boolean, String, Object
	  default: 500,
	});
	game.settings.register('htmlfilter', 'spellbook', {
	  name: 'Full Spell Book',
	  hint: 'Show the full details of all spells.',
	  scope: 'client',     // "world" = sync to db, "client" = local storage
	  config: true,       // false if you dont want it to show in module config
	  type: Boolean,       // Number, Boolean, String, Object
	  default: false,
	});
	game.settings.register('htmlfilter', 'ignore', {
	  name: 'Items to Ignore',
	  hint: 'A semicolon-delimited list of items that will ignored in item lists.',
	  scope: 'client',     // "world" = sync to db, "client" = local storage
	  config: true,       // false if you dont want it to show in module config
	  type: String,       // Number, Boolean, String, Object
	  default: "Age;Languages",
	});
	game.settings.register('htmlfilter', 'imgheight', {
	  name: 'Image Height',
	  hint: 'Height in pixels of character image. Enter 0 to omit image.',
	  scope: 'client',     // "world" = sync to db, "client" = local storage
	  config: true,       // false if you dont want it to show in module config
	  type: Number,       // Number, Boolean, String, Object
	  default: 150,
	});
	
});

function insertActorHeaderButtons(actorSheet, buttons) {
  let actor = actorSheet.object;
  buttons.unshift({
    label: "Print Character Sheet",
    icon: "fas fa-file-text",
    class: "html-filter-button",
    onclick: async () => {
		let f;
		try {
			f = new HTMLFilter();
			if (!await f.createtab())
				return false;

			f.setTitle(actor.name);
			f.filter(actor);
		} catch (msg) {
			ui.notifications.warn(msg);
		} finally {
			if (f)
				f.finish();
		}

    }
  });
}

Hooks.on("getActorSheetHeaderButtons", insertActorHeaderButtons);
