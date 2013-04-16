/**
 * View (Lightbox) functionality
 * @package Simple Lightbox
 * @subpackage View
 * @author Archetyped
 */

(function ($) {

if ( !SLB || !SLB.attach ) {
	return false;
}

/*-** Controller **-*/

var View = {
	
	/* Properties */

	/**
	 * Media item properties
	 * > Item key: Link URI
	 * > Base properties
	 *   > id: WP Attachment ID
	 *   > source: Source URI
	 *   > title: Media title (generally WP attachment title)
	 *   > desc: Media description (generally WP Attachment content)
	 *   > type: Asset type (attachment, image, etc.)
	 */
	assets: {},
	
	/**
	 * Component types that can have default instances
	 * @var array
	 */
	component_defaults: [],
	
	/**
	 * Collection of jQuery.Deferred instances added during loading routine
	 * @var array
	 */
	loading: [],
	
	/* Component Collections */
	
	viewers: {},
	items: [],
	content_handlers: {},
	groups: {},
	template_tags: {},
	
	/**
	 * Collection/Data type mapping
	 * > Key: Collection name
	 * > Value: Data type
	 * @var object
	 */
	collections: {},
	
	/**
	 * Temporary component instances
	 * For use by controller when no component instance is available
	 * > Key: Component slug
	 * > Value: Component instance 
	 */
	component_temps: {},
	
	/* Options */
	options: {
		validate_links: false,
		ui_animate: true,
		ui_enabled_desc: true,
		ui_enabled_caption: true,
		ui_caption_src: true,
		slideshow_enabled: true,
		slideshow_autostart: false,
		slideshow_duration: '6'
	},
	
	/* Methods */
	
	/* Init */
	
	update_refs: function() {
		console.groupCollapsed('Updating component references');
		var c;
		var r;
		var ref;
		for ( var p in this ) {
			if ( !this.util.is_func(this[p]) || !( '_refs' in this[p].prototype ) ) {
				continue;
			}
			console.groupCollapsed('Processing component: %o', p);
			//Set component
			c = this[p];
			if ( !this.util.is_empty(c.prototype._refs) ) {
				for ( r in c.prototype._refs ) {
					ref = c.prototype._refs[r];
					if ( this.util.is_func(ref) ) {
						continue;
					}
					if ( this.util.is_string(ref) && ref in this ) {
						ref = c.prototype._refs[r] = this[ref];
					}
					if ( !this.util.is_func(ref) ) {
						delete c.prototype_refs[r];
					}
				}
			}
			console.groupEnd();
		}
		
		/* Initialize components */
		console.log('Initializing components');
		this.init_components();
		console.groupEnd();
	},
	
	/**
	 * Initialization
	 */
	init: function(options) {
		var t = this;
		$.when.apply($, this.loading).always(function() {
			console.groupCollapsed('View.init');
			//Set options
			$.extend(true, t.options, options);
			console.groupCollapsed('Options');
			console.dir(t.options);
			console.groupEnd();
			
			//History
			$(window).on('popstate', function(e) {
				console.warn('Event: popstate');
				var state = e.originalEvent.state;
				console.info('History Length: %o', history.length);
				if ( t.util.in_obj(state, ['item', 'viewer']) ) {
					console.info('Event: popstate \n %o', state);
					var v = t.get_viewer(state.viewer);
					v.history_handle(e);
					return e.preventDefault();
				}
			});
			
			/* Set defaults */
			
			//Items
			t.init_items();
			console.info('Init complete');
			console.groupEnd();
		});
	},
	
	init_components: function() {
		this.collections = {
			'viewers':	 			this.Viewer,
			'items':				this.Content_Item,
			'content_handlers': 	this.Content_Handler,
			'groups': 				this.Group,
			'themes': 				this.Theme,
			'template_tags': 		this.Template_Tag
		};
		
		this.component_defaults = [
			this.Viewer,
		];
	
	},
	
	/* Components */

	component_make_default: function(type) {
		console.groupCollapsed('View.component_make_default');
		var ret = false;
		console.dir(this.component_defaults);
		for ( var x = 0; x < this.component_defaults.length; x++ ) {
			console.log(x);
			console.log('Checking: %o \nMatch: %o', this.component_defaults[x].prototype._slug);
			if ( type == this.component_defaults[x] ) {
				ret = true;
				break;
			}
		}
		console.log('Type: %o \nDefaults: %o', type.prototype._slug, ret);
		console.groupEnd();
		return ret;
	},
	
	/**
	 * Validates component type
	 * @param function comp Component type to check
	 * @return bool TRUE if param is valid component, FALSE otherwise
	 */
	check_component: function(comp) {
		//Validate component type
		return ( this.util.is_func(comp) && ('_slug' in comp.prototype ) && ( comp.prototype instanceof (this.Component) ) ) ? true : false;
	},
	
	/**
	 * Retrieve collection of components of specified type
	 * @param function type Component type
	 * @return object|array|null Component collection (NULL if invalid)
	 */
	get_components: function(type) {
		var ret = null;
		if ( this.util.is_func(type) ) {
			//Determine collection
			for ( var coll in this.collections ) {
				if ( type == this.collections[coll] && coll in this ) {
					ret = this[coll];
					break;
				}
			}
		}
		return ret;
	},
	
	/**
	 * Retrieve component from specific collection
	 * @param function type Component type
	 * @param string id Component ID
	 * @return object|null Component reference (NULL if invalid)
	 */
	get_component: function(type, id) {
		console.groupCollapsed('View.get_component');
		console.log('Type: %o \nSlug: %o \nID: %o', type, type.prototype._slug, id);
		var ret = null;
		//Validate parameters
		if ( !this.util.is_func(type) ) {
			console.warn('Data type is invalid');
			console.groupEnd();
			return ret;
		}
		console.info('Component type is valid');
		//Sanitize id
		if ( !this.util.is_string(id) ) {
			console.log('ID is invalid, unsetting');
			id = null;
		}
		
		//Get component from collection
		var coll = this.get_components(type);
		console.log('Components: %o', coll);
		console.log('ID: %o', id);
		if ( this.util.is_obj(coll) ) {
			var tid = ( this.util.is_string(id) ) ? id : this.util.add_prefix('default');
			console.log('Checking for component: %o', tid);
			if ( tid in coll ) {
				console.log('Component found, retrieving');
				ret = coll[tid];
			}
		}
		
		//Default: Create default component
		if ( this.util.is_empty(ret) ) {
			console.warn('Component does not exist\nID: %o \nType: %o \nReturn: %o', id, type.prototype._slug, ret);
			if ( this.util.is_string(id) || this.component_make_default(type) ) {
				console.log('Creating new component instance');
				ret = this.add_component(type, id);
			}
		}
		console.groupEnd();
		//Return component
		return ret;
	},
	
	/**
	 * Create new component instance and save to appropriate collection
	 * @param function type Component type to create
	 * @param string id ID of component
	 * @param object options Component initialization options (Default options used if default component is allowed)
	 * @return object|null New component (NULL if invalid)
	 */
	add_component: function(type, id, options) {
		console.groupCollapsed('View.add_component');
		console.log('Type: %o \nID: %o \nOptions: %o', type, id, options);
		//Validate type
		if ( !this.util.is_func(type) ) {
			console.warn('Invalid type');
			console.groupEnd();
			return false;
		}
		//Validate request
		if ( this.util.is_empty(id) && !this.component_make_default(type) ) {
			console.warn('Invalid request');
			console.groupEnd();
			return false;
		}
		//Defaults
		var ret = null;
		if ( this.util.is_empty(id) ) {
			id = this.util.add_prefix('default');
		}
		if ( !this.util.is_obj(options) ) {
			options = {};
		}
		//Check if specialized method exists for component type
		var m = ( 'component' != type.prototype._slug ) ? 'add_' + type.prototype._slug : null;
		if ( !this.util.is_empty(m) && ( m in this ) && this.util.is_func(this[m]) ) {
			console.log('Passing to specialized constructor');
			ret = this[m](id, options);
		}
		//Default process
		else {
			console.log('Calling constructor directly');
			ret = new type(id, options);
		}
		
		//Add new component to collection
		if ( this.util.is_type(ret, type) ) {
			//Get collection
			var coll = this.get_components(type);
			//Add to collection
			switch ( $.type(coll) ) {
				case 'object' :
					coll[id] = ret;
					break;
				case 'array' :
					coll.push(ret);
					break;
			}
		} else {
			ret = null;
		}
		console.groupEnd();
		//Return new component
		return ret;
	},
	
	/**
	 * Create new temporary component instance
	 * @param function type Component type
	 * @return New temporary instance
	 */
	add_component_temp: function(type) {
		var ret = null;
		if ( this.check_component(type) ) {
			//Create new instance
			ret = new type('');
			//Save to collection
			this.component_temps[ret._slug] = ret;
		}
		return ret;
	},
	
	/**
	 * Retrieve temporary component instance
	 * Creates new temp component instance for type if not previously created
	 * @param function type Component type to retrieve temp instance for
	 * @return obj Temporary component instance
	 */
	get_component_temp: function(type) {
		console.info('Get default component: %o', type.prototype._slug);
		return ( this.has_component_temp(type) ) ? this.component_temps[type.prototype._slug] : this.add_component_temp(type);
	},
	
	/**
	 * Check if temporary component instance exists
	 * @param function type Component type to check for
	 * @return bool TRUE if temp instance exists, FALSE otherwise 
	 */
	has_component_temp: function(type) {
		return ( this.check_component(type) && ( type.prototype._slug in this.component_temps ) ) ? true : false;
	},
	
	/* Properties */
	
	/**
	 * Retrieve specified options
	 * @param array opts Array of option names
	 * @return object Specified options (Default: empty object)
	 */
	get_options: function(opts) {
		console.groupCollapsed('View.get_options');
		console.info('Options to get: %o', opts);
		var ret = {};
		//Validate
		if ( this.util.is_string(opts) ) {
			opts = [opts];
		}
		if ( !this.util.is_array(opts) ) {
			console.warn('No options specified');
			console.groupEnd();
			return ret;
		}
		//Get specified options
		for ( var x = 0; x < opts.length; x++ ) {
			//Skip if option not set
			if ( !( opts[x] in this.options ) ) {
				continue;
			}
			ret[ opts[x] ] = this.options[ opts[x] ]; 
		}
		console.info('Options retrieved: %o', ret);
		console.groupEnd();
		return ret;
	},
	
	/**
	 * Retrieve option
	 * @uses View.options
	 * @param string opt Option to retrieve
	 * @param mixed def (optional) Default value if option does not exist (Default: NULL)
	 * @return mixed Option value
	 */
	get_option: function(opt, def) {
		var ret = this.get_options(opt);
		if ( this.util.is_obj(ret) && ( opt in ret ) ) {
			ret = ret[opt];
		} else {
			ret = ( this.util.is_set(def) ) ? def : null;
		}
		return ret;
	},
	
	/* Viewers */
	
	/**
	 * Add viewer instance to collection
	 * @param string id Viewer ID
	 * @param obj options Viewer options
	 */
	add_viewer: function(id, options) {
		console.groupCollapsed('View.add_viewer');
		console.log('ID: %o \nOptions: %o', id, options);
		//Validate
		if ( !this.util.is_string(id) ) {
			console.groupEnd();
			return false;
		}
		if ( !this.util.is_obj(options, false) ) {
			options = {};
		}
		//Create viewer
		var v = new this.Viewer(id, options);
		//Add to collection
		this.viewers[v.get_id()] = v;
		console.groupEnd();
		//Return viewer
		return v;
	},
	
	/**
	 * Retrieve all viewer instances
	 * @return obj Viewer instances
	 */
	get_viewers: function() {
		return this.viewers;
	},
	
	/**
	 * Check if viewer exists
	 * @param string v Viewer ID
	 * @return bool TRUE if viewer exists, FALSE otherwise
	 */
	has_viewer: function(v) {
		return ( this.util.is_string(v) && v in this.get_viewers() ) ? true : false;
	},
	
	/**
	 * Retrieve Viewer instance
	 * Default viewer retrieved if specified viewer does not exist
	 * > Default viewer created if necessary
	 * @param string v Viewer ID to retrieve
	 * @return Viewer Viewer instance
	 */
	get_viewer: function(v) {
		//Retrieve default viewer if specified viewer not set
		if ( !this.has_viewer(v) ) {
			v = this.util.add_prefix('default');
			//Create default viewer if necessary
			if ( !this.has_viewer(v) ) {
				this.add_viewer(v);
			}
		}
		return this.get_viewers()[v];
	},
	
	/* Items */
	
	/**
	 * Set event handlers
	 */
	init_items: function() {
		console.groupCollapsed('Items');
		//Define handler
		var t = this;
		var handler = function() {
			var ret = t.show_item(this);
			if ( !t.util.is_bool(ret) ) {
				ret = true;
			}
			console.info('Show Item: %o', ret);
			return !ret;
		};
		
		//Get activated links
		var sel = 'a[href][%s="%s"]'.sprintf(this.util.get_attribute('active'), 1);
		console.log('Selector: %o \nItems: %o', sel, $(sel));
		//Add event handler
		$(document).on('click', sel, handler);
		console.groupEnd();
	},
	
	get_items: function() {
		return this.get_components(this.Content_Item);
	},
	
	/**
	 * Retrieve specific Content_Item instance
	 * @param mixed Item reference
	 * > Content_Item: Item instance (returned immediately)
	 * > DOM element: DOM element to get item for
	 * > int: Index of cached item
	 * @return Content_Item Item instance for DOM node
	 */
	get_item: function(ref) {
		console.groupCollapsed('View.get_item');
		console.log('Item reference: %o', ref);
		//Evaluate reference type
		
		//Content Item instance
		if ( this.util.is_type(ref, this.Content_Item) ) {
			return ref;
		}
		//Retrieve item instance
		var item = null;
		
		//DOM element
		if ( this.util.in_obj(ref, 'nodeType') ) {
			console.info('Reference is DOM element: %o', ref);
			//Check if item instance attached to element
			var key = this.get_component_temp(this.Content_Item).get_data_key();
			console.log('Data Key: %o', key);
			item = $(ref).data(key);
		}
		//Cached item (index)
		else if ( this.util.is_int(ref, false) ) {
			var items = this.get_items();
			if ( items.length > ref ) {
				item = items[ref];
			}
		}
		//Create default item instance
		if ( !this.util.is_type(item, this.Content_Item) ) {
			console.info('Creating new content item');
			item = this.add_item(ref);
		}
		console.info('Returning item: %o', item);
		console.groupEnd();
		return item;
	},
	
	/**
	 * Create new item instance
	 * @param obj el DOM element representing item
	 * @return Content_Item New item instance
	 */
	add_item: function(el) {
		console.groupCollapsed('View.add_item: %o', el);
		var item = new this.Content_Item(el);
		console.log('Item: %o \nInstance: %o', el, item);
		console.log('Item ID: %o', item.get_attribute('id'));
		console.groupEnd();
		return item;
	},
	
	/**
	 * Display item in viewer
	 * @param obj el DOM element representing item
	 */
	show_item: function(el) {
		console.group('View.show_item');
		var ret = this.get_item(el).show();
		console.groupEnd();
		return ret;
	},
	
	/**
	 * Cache item instance
	 * @uses this.items to store cached items
	 * @param Content_Item item Item to cache
	 * @return int Index of item in cache
	 */
	save_item: function(item) {
		var ret = -1; 
		if ( !this.util.is_type(item, this.Content_Item) ) {
			return ret;
		}
		var prop = 'items';
		var items = this.get_items();
		//Check if item exists in collection
		ret = items.indexOf(item);
		//Cache item
		if ( -1 == ret ) {
			ret = items.push(item) - 1;
		}
		//Return item index in cache
		return ret;
	},
	
	/* Content Handler */
	
	get_content_handlers: function() {
		return this.get_components(this.Content_Handler);
	},
	
	/**
	 * Find matching content handler for item
	 * @param Content_Item|string item Item to find handler for (or ID of Handler)
	 * @return Content_Handler|null Matching content handler (NULL if no matching handler found) 
	 */
	get_content_handler: function(item) {
		console.groupCollapsed('View.get_content_handler');
		//Determine handler to retrieve
		var type = ( this.util.is_type(item, this.Content_Item) ) ? item.get_attribute('type', '') : item.toString();
		//Retrieve handler
		var types = this.get_content_handlers();
		console.groupEnd();
		return ( type in types ) ? types[type] : null;
	},
	
	/**
	 * Add Content Handler
	 * @param string id Handler ID
	 * @param obj attributes (optional) Handler properties/methods
	 */
	add_content_handler: function(id, attributes) {
		console.groupCollapsed('View.add_content_handler');
		//Validate
		if ( !this.util.is_string(id) ) {
			console.error('ID not set');
			console.groupEnd();
			return false;
		}
		var dfr = $.Deferred();
		var t = this;
		
		if ( !this.util.is_obj(attributes, false) ) {
			//Check for URI (external loading)
			if ( this.util.is_string(attributes) ) {
				$.get(attributes).always(function(data, textStatus) {
					var r = null;
					try {
						eval('r = ' + data);
					} catch (e) {}
					if ( !t.util.is_obj(r) ) {
						r = {};
					}
					dfr.resolve(r);
				});
			} else {
				dfr.resolve({});
			}
		} else {
			dfr.resolve(attributes);
		}
		
		dfr.done(function(o) {
			console.info('Saving content handler properties');
			//Save
			var types = t.get_components(t.Content_Handler);
			console.log(types);
			if ( !t.util.is_obj(types, false) ) {
				console.log('Init types');
				types = {};
			}
			types[id] = new t.Content_Handler(id, o);
			console.log('Types: %o \nCollection: %o', types, t.get_components(t.Content_Handler));
			console.groupEnd();
		});
	},
	
	/**
	 * Update content handler
	 * @param string id Handler to update
	 * @param obj attr Variable number of attribute objects to add handlera
	 */
	update_content_handler: function(id, attr) {
		if ( !this.util.is_string(id) || !this.util.is_obj(attr) ) {
			return false;
		}
		//Get existing handler
		var h = this.get_content_handler(id);
		if ( null == h ) {
			return false;
		}
		//Add additional attributes
		h.set_attributes(attr);
	},
	
	/* Group */
	
	/**
	 * Add new group
	 * @param string g Group ID
	 *  > If group with same ID already set, new group replaces existing one
	 * @param object attrs (optional) Group attributes
	 */
	add_group: function(g, attrs) {
		console.groupCollapsed('View.add_group');
		//Create new group
		g = new this.Group(g, attrs);
		console.log('New group: %o', g.get_id());
		//Add group to collection
		if ( this.util.is_string(g.get_id()) ) {
			this.groups[g.get_id()] = g;
			console.log('Add group to collection');
		}
		console.groupEnd();
	},
	
	/**
	 * Retrieve groups
	 * @uses groups property
	 * @return object Registered groups
	 */
	get_groups: function() {
		return this.groups;
	},
	
	/**
	 * Retrieve specified group
	 * @param string g Group ID
	 * @return object|null Group instance (NULL if group does not exist)
	 */
	get_group: function(g) {
		console.groupCollapsed('View.get_group');
		if ( this.util.is_string(g) ) {
			if ( !this.has_group(g) ) {
				//Add new group (if necessary)
				this.add_group(g);
			}
			//Retrieve group
			g = this.get_groups()[g];
		}
		console.groupEnd();
		return ( this.util.is_type(g, this.Group) ) ? g : null;
	},
	
	/**
	 * Checks if group is registered
	 * @uses get_groups() to retrieve registered groups
	 * @return bool TRUE if group exists, FALSE otherwise
	 */
	has_group: function(g) {
		return ( this.util.is_string(g) && ( g in this.get_groups() ) ) ? true : false;
	},
	
	/* Theme */
	
	/**
	 * Add theme
	 * @param string name Theme name
	 * @param obj attr Theme options
	 * > Multiple attribute parameters are merged
	 * @return obj Theme model
	 */
	add_theme: function(id, attr) {
		console.groupCollapsed('View.add_theme');
		console.log('ID: %o \nAttributes: %o', id, attr);
		var t = this;
		//Validate
		if ( !this.util.is_string(id) ) {
			console.groupEnd();
			return false;
		}
		var dfr = $.Deferred();
		this.loading.push(dfr);
		
		//Build attributes
		var attrs = [{'parent': null}];
		if ( arguments.length >= 2 ) {
			var args = Array.prototype.slice.call(arguments, 1);
			var t = this;
			$.each(args, function(idx, arg) {
				if ( t.util.is_obj(arg) ) {
					console.log('Adding attributes');
					console.dir(arg);
					attrs.push(arg)
				}
			});
		}
		
		//Set ID
		attrs.push({'id': id});
		
		//Create theme model
		var model = $.extend.apply(null, attrs);
		
		//Connect to parent model
		if ( this.util.is_string(model.parent) ) {
			model.parent = this.get_theme_model(model.parent);
		}
		
		/* Process attributes */
		
		//Layout
		var prop_layout = 'layout_uri';
		var dfr_layout = $.Deferred();
		if ( prop_layout in model && this.util.is_string(model[prop_layout]) ) {
			$.get(model[prop_layout]).always(function(data) {
				//Set layout (raw) attribute
				if ( t.util.is_string(data) ) {
					model['layout_raw'] = data;
				}
				dfr_layout.resolve();
			});
		} else {
			dfr_layout.resolve();
		}
		
		//Attributes (external)
		var prop_script = 'client_script';
		var dfr_script = $.Deferred();
		if ( prop_script in model && this.util.is_string(model[prop_script]) ) {
			//Retrieve client script
			$.get(model[prop_script]).always(function(data) {
				var r = null;
				try {
					eval('r = ' + data);
				} catch (e) {}
				if ( t.util.is_obj(r) ) {
					//Add attributes to model
					$.extend(model, r);
				}
				dfr_script.resolve();
			});
		} else {
			dfr_script.resolve();
		}
		
		//Styles
		var prop_style = 'client_style';
		if ( prop_style in model && this.util.is_string(model[prop_style]) ) {
			//Add stylesheet to document
			$('<link />', {
				'id': 'theme_style_' + model.id,
				'href': model[prop_style],
				'type': 'text/css',
				'rel': 'stylesheet'
			}).appendTo('body');
		}
		
		//Complete loading when all components loaded
		$.when(dfr_layout, dfr_script).always(function() {
			dfr.resolve();
		});
		//Add theme model
		this.Theme.prototype._models[id] = model;
		console.groupEnd();
		return model;
	},
	
	/**
	 * Update theme model
	 * @param string id Theme to update
	 * @param obj attr Variable number of attribute objects to add to model
	 */
	update_theme: function(id, attr) {
		var model = this.get_theme_model(id);
		var args = Array.prototype.slice.call(arguments);
		if ( this.util.is_empty(model) ) {
			model = this.add_model.apply(this, args);
		} else {
			//Process attributes
			args.shift();
			var attrs = [];
			var t = this;
			$.each(args, function(idx, arg) {
				if ( t.util.is_obj(arg) ) {
					attrs.push(arg);
				}
			});
			//Merge attributes into model
			attrs.unshift(model);
			$.extend.apply($, attrs);
		}
		return model;
	},
	
	/**
	 * Retrieve theme models
	 * @return obj Theme models
	 */
	get_theme_models: function() {
		//Retrieve matching theme model
		return this.Theme.prototype._models;
	},
	
	/**
	 * Retrieve theme model
	 * @param string id Theme to retrieve
	 * @return obj Theme model (Default: empty object)
	 */
	get_theme_model: function(id) {
		var ms = this.get_theme_models();
		return ( this.util.in_obj(ms, id) ) ? ms[id] : {};
	},
	
	/**
	 * Add Theme Tag Handler to Theme prototype
	 * @param string id Unique ID
	 * @param obj attrs (optional) Default tag attributes/values (or URI to attributes definition)
	 */
	add_template_tag_handler: function(id, attributes) {
		console.groupCollapsed('View.add_content_handler');
		//Validate
		if ( !this.util.is_string(id) ) {
			console.error('ID not set');
			console.groupEnd();
			return false;
		}
		var dfr = $.Deferred();
		var t = this;
		
		if ( !this.util.is_obj(attributes, false) ) {
			//Check for URI (external loading)
			if ( this.util.is_string(attributes) ) {
				$.get(attributes).always(function(data) {
					var r = null;
					try {
						eval('r = ' + data);
					} catch (e) {}
					if ( !t.util.is_obj(r) ) {
						r = {};
					}
					dfr.resolve(r);
				});
			} else {
				dfr.resolve({});
			}
		} else {
			dfr.resolve(attributes);
		}
		
		dfr.done(function(o) {
			console.info('Saving content handler properties');
			//Add handler
			t.get_template_tag_handlers()[id] = new t.Template_Tag_Handler(id, o);
			console.groupEnd();
		});
	},
	
	/**
	 * Retrieve Template Tag Handler collection
	 * @return obj Template_Tag_Handler objects
	 */
	get_template_tag_handlers: function() {
		return this.Template_Tag.prototype.handlers;
	},
	
	/**
	 * Retrieve template tag handler
	 * @param string id ID of tag handler to retrieve
	 * @return Template_Tag_Handler Tag Handler instance (new instance for invalid ID)
	 */
	get_template_tag_handler: function(id) {
		var handlers = this.get_template_tag_handlers();
		//Retrieve existing handler
		if ( this.util.is_string(id) && ( id in handlers ) ) {
			return handlers[id];
		}
		//Default: Return empty handler
		return new this.Template_Tag_Handler(id, {});
	}
};

/* Components */
var Component = {
	/*-** Properties **-*/
	
	/* Internal/Configuration */
	
	/**
	 * Base name of component type
	 * @var string
	 */
	_slug: 'component',
	
	/**
	 * Valid component references for current component
	 * > Key (string): Property name that stores reference
	 * > Value (function): Data type of component
	 * @var object
	 */
	_refs: {},
	
	/**
	 * Components that may contain current object
	 * Used for retrieving data from a parent object
	 * Example: An Item may be contained by a Group
	 * > Value (strong): Property name of container component
	 * @var array
	 */
	_containers: [],
	
	/**
	 * Whether DOM element and component are connected in 1:1 relationship
	 * Some components will be assigned to different DOM elements depending on usage
	 * @var bool
	 */
	_reciprocal: false,
	
	/**
	 * DOM Element tied to component
	 * @var DOM Element 
	 */
	_dom: null,

	/**
	 * Default attributes
	 * @var object
	 */
	_attr_default: {},
	
	/**
	 * Attributes passed to constructor
	 * @var obj
	 */
	_attr_init: null,
	
	/**
	 * Attributes to retrieve from parent (controller)
	 * @var array
	 */
	_attr_parent: [],
	
	/**
	 * Defines how parent properties should be remapped to component properties
	 * @var object
	 */
	_attr_map: {},
	
	/**
	 * Event handlers
	 * @var object
	 * > Key: string Event type
	 * > Value: array Handlers
	 */
	_events: null,
	
	/**
	 * Status management
	 * @var object
	 * > Key: Status ID
	 * > Value: Status value
	 */
	_status: null,
	
	/* Public */
	
	attributes: false,
	
	/**
	 * Component ID
	 * @var string
	 */
	id: '',
	
	/* Init */
	
	_c: function(id, attributes) {
		console.groupCollapsed('Component.Constructor: %o', this._slug);
		//Set ID
		this.set_id(id);
		console.info('ID set: %o', id);
		
		//Save init attributes
		console.info('Setting attributes: %o', attributes);
		this._attr_init = attributes;
		this.register_hooks();
		console.groupEnd();
	},
	
	_set_parent: function() {
		this._parent = View;
		this.util._parent = this;
	},
	
	/**
	 * Register hooks on init
	 * Placeholder method to be overridden by child classes
	 */
	register_hooks: function() {},
	
	/* Methods */
	
	/* Properties */
	
	/**
	 * Retrieve status
	 * @param string id Status to retrieve
	 * @param bool raw (optional) Retrieve raw value (Default: FALSE)
	 * @return mixed Status value (Default: bool)
	 */
	get_status: function(id, raw) {
		var ret = false;
		if ( this.util.in_obj(this._status, id) ) {
			ret = ( !!raw ) ? this._status[id] : !!this._status[id];
		}
		return ret;
	},
	
	/**
	 * Set status
	 * @param string id Status to retrieve
	 * @param mixed val Status value (Default: TRUE)
	 * @return mixed Status value (Default: bool)
	 */
	set_status: function(id, val) {
		//Validate
		if ( this.util.is_string(id) ) {
			if ( !this.util.is_set(val) ) {
				val = true;
			}
			//Initialize property
			if ( !this.util.is_obj(this._status, false) ) {
				this._status = {};
			}
			//Set status
			this._status[id] = val;
		} else if ( !this.util.is_set(val) ) {
			val = false;
		}
		return val;
	},
	
	/**
	 * Retrieve instance ID
	 * @uses id as ID base
	 * @uses _slug to add namespace (if necessary)
	 * @param bool ns (optional) Whether or not to namespace ID (Default: FALSE)
	 * @return string Instance ID
	 */
	get_id: function(ns) {
		//Validate
		if ( !this.check_id() ) {
			this.id = '';
		}
		var id = this.id;
		//Namespace ID
		if ( this.util.is_bool(ns) && ns ) {
			id = this.add_ns(id);
		}
		
		return id;
	},
	
	/**
	 * Set instance ID
	 * @param string id Unique ID
	 */
	set_id: function(id) {
		this.id = ( this.check_id(id) ) ? id : '';
	},
	
	/**
	 * Validate ID value
	 * @param string id (optional) ID value (Default: Component ID)
	 * @param bool nonempty (optional) TRUE if it should also check for empty strings, FALSE otherwise (Default: FALSE)
	 * @return bool TRUE if ID is valid, FALSE otherwise
	 */
	check_id: function(id, nonempty) {
		//Validate
		if ( arguments.length == 1 && this.util.is_bool(arguments[0]) ) {
			nonempty = arguments[0];
			id = null;
		}
		if ( this.util.is_empty(id) ) {
			id = this.id;
		}
		if ( !this.util.is_bool(nonempty) ) {
			nonempty = false;
		}
		return ( this.util.is_string(id, nonempty) ) ? true : false;
	},
	
	/**
	 * Get namespace
	 * @uses _slug for namespace segment
	 * @uses Util.add_prefix() to prefix slug
	 * @return string Component namespace
	 */
	get_ns: function() {
		return this.util.add_prefix(this._slug);
	},
	
	/**
	 * Add namespace to value
	 * @param string val Value to namespace
	 * @return string Namespaced value (Empty string if invalid value provided)
	 */
	add_ns: function(val) {
		return ( this.util.is_string(val) ) ? this.get_ns() + '_' + val : '';
	},
	
	/* Components */
	
	/**
	 * Retrieve component containers
	 * @uses _container property
	 * @return array Component containers
	 */
	get_containers: function() {
		//Sanitize property
		if ( !this.util.is_array(this._containers) ) {
			this._containers = [];
		}
		//Return value
		return this._containers;
	},
	
	/**
	 * Check if current object has potential container objects
	 * @return bool TRUE if containers exist, FALSE otherwise
	 */
	has_containers: function() {
		return ( this.get_containers().length > 0 );
	},
	
	/**
	 * Check if reference exists in object
	 * @param string ref Reference ID
	 * @return bool TRUE if reference exists, FALSE otherwise
	 */
	has_reference: function(ref) {
		return ( this.util.is_string(ref) && ( ref in this ) && ( ref in this.get_references() ) ) ? true : false;
	},
	
	/**
	 * Retrieve object references
	 * @uses _refs
	 * @return obj References object

	 */
	get_references: function() {
		return this._refs;
	},
	
	/**
	 * Retrieve reference data type
	 * @param string ref Reference ID
	 * @return function Reference data type (NULL if invalid)
	 */
	get_reference: function(ref) {
		return ( this.has_reference(ref) ) ? this._refs[ref] : null;
	},
	
	/**
	 * Checks if component is valid
	 * @param obj|string Component instance or ID
	 *  > If ID is specified then it will check for component on current instance
	 * @param function|string ctype Component type
	 *  > If component is an object, then ctype is required
	 *  > If component is string ID, then ctype is optional (Default: reference type)
	 *  > If ctype is a function, then it is compared to component directly
	 *  > If ctype is a string, then the component reference type is retrieved
	 * @uses get_reference()
	 * @return bool TRUE if component is valid, FALSE otherwise
	 */
	check_component: function(comp, ctype) {
		//Validate
		if ( this.util.is_empty(comp)
			|| ( this.util.is_obj(comp) && !this.util.is_func(ctype) )
			|| ( this.util.is_string(comp) && !this.has_reference(comp) )
			|| ( this.util.is_empty(ctype) && !this.util.is_string(comp) )
			|| ( !this.util.is_obj(comp) && !this.util.is_string(comp) )
		) {
			return false;
		}
		//Get component type
		if ( !this.util.is_func(ctype) ) {
			//Component is a string ID
			ctype = this.get_reference(comp);
		}
		//Get component instance
		if ( this.util.is_string(comp) ) {
			comp = this.get_component(comp, false);
		}
		return this.util.is_type(comp, ctype);
	},
	
	/**
	 * Retrieve component reference from current object
	 * > Procedure:
	 *   > Check if property already set
	 *   > Check attributes
	 *   > Check container object(s)
	 * 	 > Check parent object (controller)
	 * @uses _containers to check potential container components for references
	 * @param string cname Component name
	 * @param bool check_attr (optional) Whether or not to check instance attributes for component (Default: TRUE)
	 * @param bool get_default (optional) Whether or not to retrieve default object from controller if none exists in current instance (Default: TRUE)
	 * @param bool recursive (optional) Whether or not to check containers for specified component reference (Default: TRUE) 
	 * @return object|null Component reference (NULL if no component found)
	 */
	get_component: function(cname, check_attr, get_default, recursive) {
		console.groupCollapsed('Component.get_component(): %o', cname);
		console.log('Property: %o \nCheck Attribute: %o\nGet Default: %o \nRecursive: %o', cname, check_attr, get_default, recursive);
		var c = null;
		//Validate request
		if ( !this.util.is_string(cname) || !( cname in this ) || !this.has_reference(cname) ) {
			console.warn('Request is invalid, quitting\nName: %o \nValid Property: %o \nHas Reference: %o \nReferences: %o', cname, (cname in this), this.has_reference(cname), this._refs);
			console.groupEnd();
			return c;
		}
		
		//Normalize parameters
		if ( !this.util.is_bool(check_attr) ) {
			check_attr = true;
		}
		if ( !this.util.is_bool(get_default) ) {
			get_default = true;
		}
		if ( !this.util.is_bool(recursive) ) {
			recursive = true;
		}
		var ctype = this._refs[cname];
		console.log('Validated Parameters\nProperty: %o \nType: %o \nGet Default: %o \nRecursive: %o', cname, ctype.prototype._slug, get_default, recursive);
		//Phase 1: Check if component reference previously set
		console.info('Check for property');
		if ( this.util.is_type(this[cname], ctype) ) {
			console.log('Component is set returning immediately: %o', this[cname]);
			console.groupEnd();
			return this[cname];
		}
		console.warn('First-class property not set');
		//If reference not set, iterate through component hierarchy until reference is found
		c = this[cname] = null;
				
		//Phase 2: Check attributes
		if ( check_attr ) {
			console.info('Check for component in attributes');
			console.log('Attributes: %o', this.get_attributes());
			c = this.get_attribute(cname);
			console.log('Attribute value: %o', c);
			//Save object-specific component reference
			if ( !this.util.is_empty(c) ) {
				console.log('Saving component');
				c = this.set_component(cname, c);
			}
		}

		//Phase 3: Check Container(s)
		if ( recursive && this.util.is_empty(c) && this.has_containers() ) {
			console.info('Checking object container(s)');
			var containers = this.get_containers();
			console.log('Containers: %o', containers);
			var con = null;
			for ( var i = 0; i < containers.length; i++ ) {
				con = containers[i];
				console.groupCollapsed('Container %d : %s', i, con);
				//Validate container
				if ( con == cname ) {
					console.warn('Container is current component, skipping');
					console.groupEnd();
					continue;
				}
				//Retrieve container
				con = this.get_component(con, true, false);
				console.log('Container: %o', con);
				if ( this.util.is_empty(con) ) {
					console.warn('Container could not be found, skipping');
					console.groupEnd();
					continue;
				}
				console.log('Check for component in container: %o', con);
				//Attempt to retrieve component from container
				c = con.get_component(cname);
				console.info('Component: %o', c);
				//Stop iterating if valid component found
				if ( !this.util.is_empty(c) ) {
					console.groupEnd();
					break;
				}
				console.groupEnd();
			}
		}
		
		//Phase 4: From controller (optional)
		if ( get_default && this.util.is_empty(c) ) {
			console.info('Get default component (from controller)');
			c = this.get_parent().get_component(ctype);
		}
		console.log('Component: %o', c);
		console.groupEnd();		
		return c;
	},
	
	/**
	 * Sets component reference on current object
	 *  > Component property reset (set to NULL) if invalid component supplied
	 * @param string name Name of property to set component on object
	 * @param string|object ref Component or Component ID (to be retrieved from controller)
	 * @param function validate (optional) Additional validation to be performed (Must return bool: TRUE (Valid)/FALSE (Invalid))
	 * @return object Component (NULL if invalid)
	 */
	set_component: function(name, ref, validate) {
		console.groupCollapsed('Component.set_component: %o', name);
		console.log('Component: %o \nObject: %o', name, ref);
		var clear = null;
		//Make sure component property exists
		if ( !this.has_reference(name) ) {
			console.groupEnd();
			return clear;
		}
		//Normalize reference
		if ( this.util.is_empty(ref) ) {
			ref = clear;
		}
		var ctype = this.get_reference(name); 
		
		//Get component from controller if ID supplied
		if ( this.util.is_string(ref) ) {
			ref = this.get_parent().get_component(ctype, ref);
		}
		
		if ( !this.util.is_type(ref, ctype) ) {
			ref = clear;
		}

		//Additional validation
		if ( !this.util.is_empty(ref) && this.util.is_func(validate) && !validate.call(this, ref) ) {
			ref = clear;
		}
		//Set (or clear) component reference
		this[name] = ref;
		console.groupEnd();
		//Return value for confirmation
		return this[name];
	},

	/* Attributes */
	
	/**
	 * Initializes attributes
	 */
	init_attributes: function(force) {
		if ( !this.util.is_bool(force) ) {
			force = false;
		}
		if ( force || !this.util.is_obj(this.attributes) ) {
			console.groupCollapsed('Component.init_attributes');
			console.info('Initializing attributes');
			this.attributes = {};
			//Build attribute groups
			var attrs = [{}];
			attrs.push(this.init_default_attributes());
			if ( this.dom_has() ) {
				attrs.push(this.get_dom_attributes());
			}
			if ( this.util.is_obj(this._attr_init) ) {
				attrs.push(this._attr_init);
			}
			console.log('Attribute objects: %o', attrs);
			//Merge attributes
			this.attributes = $.extend.apply(null, attrs);
			console.groupEnd();
		}
	},
	
	/**
	 * Generate default attributes for component
	 * @uses _attr_parent to determine options to retrieve from controller
	 * @uses View.get_options() to get values from controller
	 * @uses _attr_map to Remap controller attributes to instance attributes
	 * @uses _attr_default to Store default attributes
	 */
	init_default_attributes: function() {
		console.groupCollapsed('Component.init_default_attributes');
		console.log('Default attributes: %o', this._attr_default);
		console.log('Get parent options: %o', this._attr_parent);
		//Get parent options
		var opts = this.get_parent().get_options(this._attr_parent);
		console.log('Parent Options: %o \nEmpty: %o', opts, this.util.is_empty(opts));
		if ( this.util.is_obj(opts) ) {
			console.log('Remap options: %o \nMap: %o', opts, this._attr_map);
			//Remap
			for ( var opt in this._attr_map ) {
				if ( opt in opts ) {
					//Move value to new property
					opts[this._attr_map[opt]] = opts[opt];
					//Delete old property
					delete opts[opt];
				}
			}
			console.info('Options remapped: %o', opts);
			//Merge with default attributes
			$.extend(true, this._attr_default, opts);
			console.log('Options merged with defaults: %o', this._attr_default);
		}
		console.groupEnd();
		return this._attr_default;
	},
	
	/**
	 * Retrieve DOM attributes
	 */
	get_dom_attributes: function() {
		console.groupCollapsed('Component.get_dom_attributes');
		var attrs = {};
		var el = this.dom_get();
		if ( el.length ) {
			console.info('Checking DOM element for attributes');
			//Get attributes from element
			var opts = $(el).get(0).attributes;
			if ( this.util.is_obj(opts) ) {
				console.group('Processing DOM Attributes: %o', opts);
				var attr_prefix = this.util.get_attribute();
				$.each(opts, function(idx, opt) {
					if ( opt.name.indexOf( attr_prefix ) == -1 ) {
						return true;
					}
					console.log('Index: %o \nOption: %o', idx, opt.name);
					//Process custom attributes
					//Strip prefix
					var key = opt.name.substr(attr_prefix.length + 1);
					console.log('Attribute: %o \nValue: %o', key, opt.value);
					attrs[key] = opt.value;
				});
				console.groupEnd();
			}
		}
		console.log('DOM Attribute: %o', attrs);
		console.groupEnd();
		return attrs;
	},
	
	/**
	 * Retrieve all instance attributes
	 * @uses parse_attributes() to initialize attributes (if necessary)
	 * @uses attributes
	 * @return obj Attributes
	 */
	get_attributes: function() {
		//Initilize attributes
		this.init_attributes();
		//Return attributes
		return this.attributes;
	},
	
	/**
	 * Retrieve value of specified attribute for value
	 * @param string key Attribute to retrieve
	 * @param mixed def (optional) Default value if attribute is not set
	 * @param bool enforce_type (optional) Whether data type should match default value (Default: TRUE)
	 * > If possible, attribute value will be converted to match default data type
	 * > If attribute value cannot match default data type, default value will be used
	 * @return mixed Attribute value (NULL if attribute is not set)
	 */
	get_attribute: function(key, def, enforce_type) {
		//Validate
		if ( !this.util.is_set(def) ) {
			def = null;
		}
		if ( !this.util.is_string(key) ) {
			return def;
		}
		if ( !this.util.is_bool(enforce_type) ) {
			enforce_type = true;
		}
		//Get attribute value
		var ret = ( this.has_attribute(key) ) ? this.get_attributes()[key] : def;
		//Validate type
		if ( enforce_type && ret !== def && null !== def && !this.util.is_type(ret, $.type(def), false) ) {
			//Convert type
			//Scalar default
			if ( this.util.is_scalar(def, false) ) {
				//Non-scalar attribute
				if ( !this.util.is_scalar(ret, false) ) {
					ret = def;
				} else if ( this.util.is_string(def, false) ) {
					ret = ret.toString();
				} else if ( this.util.is_num(def, false) && !this.util.is_num(ret, false) ) {
					ret = ( this.util.is_int(def, false) ) ? parseInt(ret) : parseFloat(ret);
					if ( !this.util.is_num(ret, false) ) {
						ret = def;
					}
				} else if ( this.util.is_bool(def, false) ) {
					ret = ( this.util.is_string(ret) || ( this.util.is_num(ret) ) );
				} else {
					ret = def;
				}
			}
			//Non-scalar default
			else {
				ret = def;
			}
		}
		return ret;
	},
	
	/**
	 * Call attribute as method
	 * @param string attr Attribute to call
	 * @param arguments (optional) Additional arguments to pass to method
	 */
	call_attribute: function(attr, args) {
		console.groupCollapsed('Component.call_attribute');
		attr = this.get_attribute(attr);
		if ( this.util.is_func(attr) ) {
			console.info('Passing to attribute (method)');
			//Get arguments
			var args = Array.prototype.slice.call(arguments, 1);
			//Pass arguments to user-defined method
			attr = attr.apply(this, args);
		}
		console.groupEnd();
		return attr;
	},
	
	/**
	 * Check if attribute exists
	 * @param string key Attribute name
	 * @return bool TRUE if exists, FALSE otherwise
	 */
	has_attribute: function(key) {
		return ( key in this.get_attributes() );
	},
	
	/**
	 * Set component attributes
	 * @param obj attributes Attributes to set
	 * @param bool full (optional) Whether to fully replace or merge component's attributes with new values (Default: Merge)
	 */
	set_attributes: function(attributes, full) {
		console.groupCollapsed('Component.set_attributes');
		console.log('Instance Attributes: %o \nAttributes Passed: %o \nFull Reset: %o', this.attributes, attributes, full);
		if ( !this.util.is_bool(full) ) {
			full = false;
		}

		//Initialize attributes
		this.init_attributes(full);
		
		//Merge new/existing attributes
		if ( this.util.is_obj(attributes) ) {
			$.extend(this.attributes, attributes);
		}
		console.groupEnd();
	},
	
	/**
	 * Set value for a component attribute
	 * @uses get_attributes() to retrieve attributes
	 * @param string key Attribute to set
	 * @param mixed val Attribute value
	 */
	set_attribute: function(key, val) {
		if ( this.util.is_string(key) && this.util.is_set(val) ) {
			this.get_attributes()[key] = val;
		}
		return val;
	},
	
	/* DOM */

	/**
	 * Generate selector for retrieving child element
	 * @param string element Class name of child element
	 * @return string Element selector
	 */
	dom_get_selector: function(element) {
		return ( this.util.is_string(element) ) ? '.' + this.add_ns(element) : '';
	},
	
	dom_get_attribute: function() {
		return this.util.get_attribute(this._slug);
	},

	/**
	 * Set reference of instance on DOM element
	 * @uses _reciprocal to determine if DOM element should also be attached to instance
	 * @param string|obj (jQuery) el DOM element to attach instance to
	 * @return jQuery DOM element set
	 */
	dom_set: function(el) {
		console.groupCollapsed('Component.dom_set');
		console.log('Element: %o', el);
		el = $(el);
		//Save instance to DOM object
		el.data(this.get_data_key(), this);
		//Save DOM object to instance
		if ( this._reciprocal ) {
			this._dom = el;
		}
		console.groupEnd();
		return el;
	},
	
	/**
	 * Retrieve attached DOM element
	 * @uses _dom to retrieve attached DOM element
	 * @uses dom_put() to insert child element
	 * @param string element Child element to retrieve
	 * @param bool put (optional) Whether to insert element if it does not exist (Default: FALSE)
	 * @param obj options (optional) Options for creating new object
	 * @return obj jQuery DOM element
	 */
	dom_get: function(element, put, options) {
		console.groupCollapsed('Component.dom_get: %o', this._slug);
		//Init Component DOM
		if ( !this.get_status('dom_init') ) {
			this.set_status('dom_init');
			this.dom_init();
		}
		//Check for main DOM element
		var ret = this._dom;
		if ( !!ret && this.util.is_string(element) ) {
			var ch = $(ret).find( this.dom_get_selector(element) );
			//Check for child element
			if ( ch.length ) {
				ret = ch;
			} else if ( this.util.is_bool(put) && put ) {
				//Insert child element
				ret = this.dom_put(element, options);
			}
		}
		console.groupEnd();
		
		return $(ret);
	},
	
	/**
	 * Initialize DOM element
	 * To be overridden by child classes
	 */
	dom_init: function() {},
	
	/**
	 * Wrap output in DOM element
	 * Wrapper element created and added to main DOM element if not yet created
	 * @param string element ID for DOM element (Used as class name for wrapper)
	 * @param string|jQuery|obj content Content to add to DOM (Object contains element properties)
	 * 	> tag 		: Element tag name
	 * 	> content	: Element content
	 * @return jQuery Inserted element(s)
	 */
	dom_put: function(element, content) {
		console.groupCollapsed('Component.dom_put: %o', element);
		var r = null;
		//Stop processing if main DOM element not set or element is not valid
		if ( !this.dom_has() || !this.util.is_string(element) ) {
			console.warn('Invalid parameters');
			console.groupEnd();
			return $(r);
		}
		//Setup options
		console.log('Setup options');
		var strip = ['tag', 'content', 'put_success'];
		var options = {
			'tag': 'div',
			'content': '',
			'class': this.add_ns(element)
		}
		console.log('Setup content');
		//Setup content
		if ( !this.util.is_empty(content) && !this.util.is_obj(content) && !this.util.is_type(content, jQuery) ) {
			$.extend(options, content);
		} else {
			options.content = content;
		}
		var attrs = $.extend({}, options);
		console.log('Element Attributes');
		console.dir(attrs);
		for ( var x = 0; x < strip.length; x++ ) {
			delete attrs[strip[x]];
		}
		console.log('Element options');
		console.dir(options);
		//Retrieve existing element
		var d = this.dom_get();
		r = $(this.dom_get_selector(element), d);
		//Create element (if necessary)
		if ( !r.length ) {
			r = $('<%s />'.sprintf(options.tag), attrs).appendTo(d);
			console.log('Adding element: %o \nDOM: %o \nElement: %o', options, d, r);
			if ( r.length && this.util.is_method(options, 'put_success') ) {
				options['put_success'].call(r, r);
			}
		}
		//Set content
		console.log('Append content');
		$(r).append(options.content);
		console.groupEnd();
		return $(r);
	},
	
	/**
	 * Check if DOM element is set for instance
	 * DOM is initialized before evaluation 
	 * @return bool TRUE if DOM element set, FALSE otherwise
	 */
	dom_has: function() {
		return ( !!this.dom_get().length );
	},
	
	/* Data */
	
	/**
	 * Retrieve key used to store data in DOM element
	 * @return string Data key 
	 */
	get_data_key: function() {
		return this.get_ns();
	},
	
	/* Events */
	
	/**
	 * Register event handler for custom event
	 * Structure
	 * > Events (obj)
	 *   > Event-Name (array)
	 *     > Handlers (functions)
	 * @param mixed event Custom event to register handler for
	 * > string: Standard event handler
	 * > array: Multiple events to register single handler on
	 * > object: Map of events/handlers
	 * @param function fn Event handler
	 * @param obj options Handler registration options
	 * > clear (bool)	Clear existing event handlers before setting current handler (Default: FALSE)
	 * @return obj Component instance (allows chaining) 
	 */
	on: function(event, fn, options) {
		console.groupCollapsed('Component.on: %o', this._slug + '.' + event);
		console.log('Event: %o \nFunc: %o \nOptions: %o', event, fn, options);
		//Handle request types
		if ( !this.util.is_string(event) || !this.util.is_func(fn) ) { 
			var t = this;
			var args = Array.prototype.slice.call(arguments, 1);
			if ( this.util.is_array(event) ) {
				//Events array
				console.info('Event array');
				console.log('Common Arguments: %o', args);
				$.each(event, function(idx, val) {
					console.group('Registering event: %o', val);
					console.log('Arguments: %o \nMerged: %o', args, [val].concat(args));
					t.on.apply(t, [val].concat(args));
					console.groupEnd();
				});
			} else if ( this.util.is_obj(event) ) {
				//Events map
				$.each(event, function(ev, hdl) {
					t.on.apply(t, [ev, hdl].concat(args));
				});
			}
			console.groupEnd();
			return this;
		}

		//Options
		
		//Default options
		var options_std = {
			clear:	false
		};
		if ( !this.util.is_obj(options, false) ) {
			//Reset options
			options = {};
		}
		//Build options
		options = $.extend({}, options_std, options);
		//Initialize events bucket
		if ( !this.util.is_obj(this._events, false) ) {
			this._events = {};
		}
		//Setup event
		var es = this._events;
		if ( !( event in es ) || !this.util.is_obj(es[event], false) || !!options.clear ) {
			console.info('Initializing event: %o', event);
			es[event] = [];
		}
		//Add event handler
		es[event].push(fn);
		console.groupEnd();
		return this;
	},
	
	/**
	 * Trigger custom event
	 * Event handlers are executed in the context of the current component instance
	 * Event handlers are passed parameters
	 * > ev			(obj)	Event object
	 * 	> type		(string)	Event name
	 * 	> data		(mixed)		Data to pass to handlers (if supplied)
	 * > component	(obj)	Current component instance
	 * @param string event Custom event to trigger
	 * @param mixed data (optional) Data to pass to event handlers
	 * @return jQuery.Promise Promise that is resolved once event handlers are resolved
	 */
	trigger: function(event, data) {
		console.groupCollapsed('Component.trigger: %o', this._slug + '.' + event);
		var dfr = $.Deferred();
		var dfrs = [];
		var t = this;
		//Handle array of events
		if ( this.util.is_array(event) ) {
			$.each(event, function(idx, val) {
				//Collect promises from triggered events
				dfrs.push( t.trigger(val, data) );
			});
			//Resolve trigger when all events have been resolved
			$.when.apply(t, dfrs).done(function() {
				dfr.resolve();
			});
			console.groupEnd();
			return dfr.promise();
		}
		//Validate
		if ( !this.util.is_string(event) || !( event in this._events ) ) {
			console.warn('Invalid event');
			dfr.resolve();
			console.groupEnd();
			return dfr.promise();
		}
		//Create event object
		var ev = { 'type': event, 'data': null };
		//Add data to event object
		if ( this.util.is_set(data) ) {
			ev.data = data;
		}
		//Fire handlers for event
		$.each(this._events[event], function(idx, fn) {
			//Call handler (`this` set to current instance)
			//Collect promises from event handlers
			dfrs.push( fn.call(t, ev, t) );
		});
		//Resolve trigger when all handlers have been resolved
		$.when.apply(this, dfrs).done(function() {
			dfr.resolve();
		});
		console.groupEnd();
		return dfr.promise();
	}
};

View.Component = Component = SLB.Class.extend(Component);

/**
 * Content viewer
 * @param obj options Init options
 */
var Viewer = {
	
	/* Configuration */
	
	_slug: 'viewer',
	
	_refs: {
		item: 'Content_Item',
		theme: 'Theme'
	},
	
	_reciprocal: true,
	
	_attr_default: {
		loop: true,
		animate: true,
		autofit: true,
		overlay_enabled: true,
		overlay_opacity: '0.8',
		container: null,
		slideshow_enabled: true,
		slideshow_autostart: true,
		slideshow_duration: 2,
		slideshow_active: false,
		slideshow_timer: null,
		labels: {
			close: 'close',
			nav_prev: '&laquo; prev',
			nav_next: 'next &raquo;',
			slideshow_start: 'start slideshow',
			slideshow_stop: 'stop slideshow',
			group_status: 'Image %current% of %total%',
			loading: 'loading'
		}
	},
	
	_attr_parent: [
		'theme', 
		'group_loop', 
		'ui_autofit', 'ui_animate', 'ui_overlay_opacity', 'ui_labels',
		'slideshow_enabled', 'slideshow_autostart', 'slideshow_duration'],
	
	_attr_map: {
		'group_loop': 'loop',
		'ui_autofit': 'autofit',
		'ui_animate': 'animate',
		'ui_overlay_opacity': 'overlay_opacity',
		'ui_labels': 'labels'
	},
	
	/* References */
	
	/**
	 * Item currently loaded in viewer
	 * @var object Content_Item
	 */
	item: null,
	
	/**
	 * Queued item to be loaded once viewer is available
	 * @var object Content_Item
	 */
	item_queued: null,
	
	/**
	 * Theme used by viewer
	 * @var object Theme
	 */
	theme: null,
	
	/* Properties */
	
	item_working: null,
		
	active: false,
	init: false,
	open: false,
	loading: false,
	
	/* Methods */
	
	/* Init */
	
	register_hooks: function() {
		console.groupCollapsed('Viewer.register_hooks');
		var t = this;
		this
			.on(['item-prev', 'item-next'], function() {
				t.trigger('item-change');
			})
			.on(['close', 'item-change'], function() {
				t.unlock();
			});
		console.groupEnd();
	},
	
	/* References */
	
	/**
	 * Set item reference
	 * Validates item before setting
	 * @param obj item Content_Item instance
	 * @return bool TRUE if valid item set, FALSE otherwise
	 */
	set_item: function(item) {
		console.groupCollapsed('Viewer.set_item: %o', item);
		//Clear existing item
		this.clear_item(false);
		var i = this.set_component('item', item, function(item) {
			return ( item.has_type() );
		});
		console.groupEnd();
		return ( !this.util.is_empty(i) );
	},
	
	clear_item: function(full) {
		console.group('Viewer.clear_item');
		//Validate
		if ( !this.util.is_bool(full) ) {
			full = true;
		}
		console.info('Full clear: %o', full);
		var item = this.get_item();
		if ( !!item ) {
			item.reset();
		}
		if ( full ) {
			this.set_item(false);
		}
		console.groupEnd();
	},
	
	/**
	 * Retrieve item instance current attached to viewer
	 * @return Content_Item|NULL Current item instance
	 */
	get_item: function() {
		return this.get_component('item', true, false);
	},
	
	/**
	 * Retrieve theme reference
	 * @return object Theme reference
	 */
	get_theme: function() {
		console.groupCollapsed('Viewer.get_theme');
		//Get saved theme
		var ret = this.get_component('theme', false, false, false);
		if ( this.util.is_empty(ret) ) {
			//Theme needs to be initialized
			ret = this.set_component('theme', new View.Theme(this));
		}
		console.log('Theme: %o', ret);
		console.groupEnd();
		return ret;
	},
	
	/**
	 * Set viewer's theme
	 * @param object theme Theme object
	 */
	set_theme: function(theme) {
		this.set_component('theme', theme);
	},
	
	/* Properties */
	
	/**
	 * Lock the viewer
	 * Indicates that item is currently being processed
	 * @return jQuery.Deferred Resolved when item processing is complete
	 */
	lock: function() {
		return this.set_status('item_working', $.Deferred());
	},
	
	/**
	 * Retrieve lock
	 * @param bool simple (optional) Whether to return a simple status of the locked status (Default: FALSE)
	 * @param bool full (optional) Whether to return Deferred (TRUE) or Promise (FALSE) object (Default: FALSE)
	 * @return jQuery.Promise Resolved when item processing is complete
	 */
	get_lock: function(simple, full) {
		//Validate
		if ( !this.util.is_bool(simple) ) {
			simple = false;
		}
		if ( !this.util.is_bool(full) ) {
			full = false;
		}
		var s = 'item_working';
		//Simple status
		if ( simple ) {
			return this.get_status(s);
		}
		//Full value
		var r = this.get_status(s, true);
		if ( !this.util.is_promise(r) ) {
			//Create default
			r = this.lock();
		}
		return ( full ) ? r : r.promise();
	},
	
	is_locked: function() {
		return this.get_lock(true);
	},
	
	/**
	 * Unlock the viewer
	 * Any callbacks registered for this action will be executed
	 * @return jQuery.Deferred Resolved instance
	 */
	unlock: function() {
		console.groupCollapsed('Viewer.unlock');
		console.groupEnd();
		return this.get_lock(false, true).resolve();
	},
	
	/**
	 * Set Viewer active status
	 * @param bool mode (optional) Activate or deactivate status (Default: TRUE)
	 * @return bool Active status
	 */
	set_active: function(mode) {
		if ( !this.util.is_bool(mode) ) {
			mode = true;
		}
		return this.set_status('active', mode);
	},
	
	/**
	 * Check Viewer active status
	 * @return bool Active status
	 */
	is_active: function() {
		return this.get_status('active');
	},
	
	/**
	 * Set loading mode
	 * @param bool mode (optional) Set (TRUE) or unset (FALSE) loading mode (Default: TRUE)
	 * @return jQuery.Promise Promise that resolves when loading mode is set
	 */
	set_loading: function(mode) {
		console.groupCollapsed('Viewer.set_loading: %o', mode);
		var dfr = $.Deferred();
		if ( !this.util.is_bool(mode) ) {
			mode = true;
		}
		this.loading = mode;
		console.info('Loading: %o', mode);
		//Pause/Resume slideshow
		if ( this.slideshow_active() ) {
			this.slideshow_pause(mode);
		}
		//Set CSS class on DOM element
		var m = ( mode ) ? 'addClass' : 'removeClass';
		console.info('Loading method: %o', m);
		$(this.dom_get())[m]('loading');
		if ( mode ) {
			//Loading transition
			this.get_theme().transition('load').always(function() {
				dfr.resolve();
			});
		} else {
			dfr.resolve();
		}
		console.groupEnd();
		return dfr.promise();
	},
	
	/**
	 * Unset loading mode
	 * @see set_loading()
	 * @return jQuery.Promise Promise that resovles when loading mode is set
	 */
	unset_loading: function() {
		return this.set_loading(false);
	},
	
	/**
	 * Retrieve loading status
	 * @return bool Loading status (Default: FALSE)
	 */
	get_loading: function() {
		return ( this.util.is_bool(this.loading) ) ? this.loading : false;
	},
	
	/**
	 * Check if viewer is currently loading content
	 * @return bool Loading status (Default: FALSE)
	 */
	is_loading: function() {
		return this.get_loading(); 
	},
	
	/* Display */
	
	/**
	 * Display content in viewer
	 * @param Content_Item item Item to show
	 * @param obj options (optional) Display options
	 */
	show: function(item) {
		console.group('Viewer.show');
		console.info('Queue item: %o', item);
		this.item_queued = item;
		var fin_set = 'show_deferred';
		var v = this;
		var fin = function() {
			console.group('Viewer.show.load');
			//Lock viewer
			v.lock();
			//Reset callback flag (for new lock)
			v.set_status(fin_set, false);
			//Validate request
			if ( !v.set_item(v.item_queued) || !v.get_theme() ) {
				console.warn('Invalid request');
				console.groupEnd();
				v.close();
				console.groupEnd();
				return false;
			}
			//Add item to history stack
			v.history_add();
			//Activate
			v.set_active();
			//Display
			v.render();
			console.groupEnd();
		}
		if ( !this.is_locked() ) {
			fin();
		} else if ( !this.get_status(fin_set) ) {
			console.info('Setting deferred callback');
			//Set flag to avoid duplicate callbacks
			this.set_status(fin_set);
			this.get_lock().always(function() {
				fin();
			});
		}
		console.groupEnd();
	},
	
	/* History Management */
	
	history_handle: function(e) {
		console.groupCollapsed('Viewer.history_handle');
		var state = e.originalEvent.state;
		console.dir(state);
		//Load item
		if ( this.util.is_int(state.item, false) ) {
			console.info('Retrieving item');
			this.get_parent().get_item(state.item).show({'event': e});
			this.trigger('item-change');
		} else {
			var count = this.history_get(true);
			//Reset count
			this.history_set(0);
			//Close viewer
			if ( -1 != count ) {
				console.info('Closing viewer');
				this.close();
			}	
		}
		console.groupEnd();
	},
	
	history_get: function(full) {
		return this.get_status('history_count', full);
	},
	history_set: function(val) {
		return this.set_status('history_count', val);
	},
	history_add: function() {
		if ( !history.pushState ) {
			return false;
		}
		console.group('Viewer.history_add');
		//Get display options
		var item = this.get_item();
		var opts = item.get_attribute('options_show');
		//Save history state
		var count = ( this.history_get() ) ? this.history_get(true) : 0;
		if ( !this.util.in_obj(opts, 'event') ) {
			//Create state
			var state = {
				'viewer': this.get_id(),
				'item': null,
				'count': count
			};
			//Init: Save viewer state
			if ( !count ) {
				console.info('Adding Viewer reference (position): %o', count);
				history.replaceState(state, null);
				console.info('Pushed history state: %o', history.state);
			}
			//Always: Save item state
			state.item = this.get_parent().save_item(item);
			state.count = ++count;
			history.pushState(state, '');
			console.info('Pushed history state: %o', history.state);
		} else {
			var e = opts.event.originalEvent;
			if ( this.util.in_obj(e, 'state') && this.util.in_obj(e.state, 'count') ) {
				count = e.state.count;
				console.info('Using history state count: %o', count);
			}
		}
		//Save history item count
		this.history_set(count);
		console.info('History item count: %o', count);
		console.groupEnd();
	},
	history_reset: function() {
		console.group('Viewer.history_reset');
		var count = this.history_get(true);
		console.info('History count: %o', count);
		if ( count ) {
			//Clear history status
			this.history_set(-1);
			console.info('History movement: %o', -1 * count);
			//Restore history stack
			history.go( -1 * count );
		}
		console.groupEnd();
	},
		
	/**
	 * Check if viewer is currently open
	 * Checks if node is actually visible in DOM 
	 * @return bool TRUE if viewer is open, FALSE otherwise 
	 */
	is_open: function() {
		console.group('Viewer.is_open');
		console.log('DOM Display: %o', this.dom_get().css('display'));
		console.groupEnd();
		return ( this.dom_get().css('display') == 'none' ) ? false : true;
	},
	
	/**
	 * Load output into DOM
	 */
	render: function() {
		console.groupCollapsed('Viewer.render');
		//Get theme output
		console.info('Rendering Theme layout');
		var v = this;
		var thm = this.get_theme();
		//Register theme event handlers
		if ( !this.get_status('render-events') ) {
			this.set_status('render-events');
			thm
			//Loading
			.on('render-loading', function(ev, thm) {
				console.groupCollapsed('Viewer.render.loading (Callback)');
				var dfr = $.Deferred();
				if ( !v.is_active() ) {
					console.warn('Viewer not active');
					dfr.reject();
					console.groupEnd();
					return dfr.promise();
				}
				var set_pos = function() {
					//Set position
					v.dom_get().css('top', $(window).scrollTop());
				};
				var always = function() {
					//Set loading flag
					v.set_loading().always(function() {
						dfr.resolve();
					});
				};
				if ( v.is_open() ) {
					console.info('Viewer open');
					thm.transition('unload')
						.fail(function() {
							set_pos();
							thm.dom_get_tag('item', 'content').attr('style', '');
						})
						.always(always);
				} else {
					thm.transition('open')
						.always(function() {
							always();
							v.events_open();
							v.open = true;
						})
						.fail(function() {
							 set_pos();
							//Fallback open
							v.get_overlay().show();
							v.dom_get().show();
						});
				}
				console.groupEnd();
				return dfr.promise();
			})
			//Complete
			.on('render-complete', function(ev, thm) {
				console.groupCollapsed('Viewer.render.complete (Callback)');
				console.log('Completed output: %o', ev.data);
				console.info('Theme loaded');
				//Stop if viewer not active
				if ( !v.is_active() ) {
					console.groupEnd();
					return false;
				}
				//Set classes
				var d = v.dom_get();
				var classes = ['item_single', 'item_multi'];
				var ms = ['addClass', 'removeClass']; 
				if ( !v.get_item().get_group().is_single() ) {
					ms.reverse();
				}
				$.each(ms, function(idx, val) {
					d[val](classes[idx]);
				});
				//Bind events
				v.events_complete();
				//Transition
				thm.transition('complete')
					.fail(function() {
						//Autofit content
						if ( v.get_attribute('autofit', true) ) {
							var dims = $.extend({'display': 'inline-block'}, thm.get_item_dimensions());
							var tag = thm.dom_get_tag('item', 'content').css(dims);
						}
					})
					.always(function() {
						//Unset loading flag
						v.unset_loading();
						//Trigger event
						v.trigger('render-complete');
						//Set viewer as initialized
						v.init = true;
					});
				console.groupEnd();
			});
		}
		//Render
		thm.render();
		console.groupEnd();
	},
	
	/**
	 * Retrieve container element
	 * Creates default container element if not yet created
	 * @return jQuery Container element
	 */
	dom_get_container: function() {
		console.groupCollapsed('Viewer.dom_get_container');
		var sel = this.get_attribute('container');
		//Set default container
		if ( this.util.is_empty(sel) ) {
			sel = '#' + this.add_ns('wrap');
		}
		//Add default container to DOM if not yet present
		var c = $(sel);
		if ( !c.length ) {
			//Prepare ID
			var id = ( sel.indexOf('#') === 0 ) ? sel.substr(1) : sel;
			//Add element
			c = $('<div />', {'id': id}).appendTo('body');
		}
		console.groupEnd();
		return c;
	},
	
	/**
	 * Custom Viewer DOM initialization
	 */
	dom_init: function() {
		console.groupCollapsed('Viewer.dom_init');
		//Create element & add to DOM
		//Save element to instance
		var d = this.dom_set($('<div/>', {
			'id':  this.get_id(true),
			'class': this.get_ns()
		})).appendTo(this.dom_get_container()).hide();
		//Add theme classes
		var thm = this.get_theme();
		d.addClass(thm.get_classes(' '));
		console.log('Theme ID: %o', thm.get_id(true));
		console.log('DOM element added');
		//Add theme layout (basic)
		var v = this;
		console.info('Rendering basic theme layout');
		if ( !this.get_status('render-init') ) {
			this.set_status('render-init');
			thm.on('render-init', function(ev) {
				console.groupCollapsed('Viewer.dom_init.init (callback)');
				console.info('Basic layout: %o', ev.data);
				//Add rendered theme layout to viewer DOM
				v.dom_put('layout', ev.data);
				console.groupEnd();
			});
		}
		thm.render(true);
		console.groupEnd();
	},
	
	/**
	 * Restore DOM
	 * Show overlapping DOM elements, etc.
	 * @TODO Build functionality
	 */
	dom_restore: function() {},
	
	/* Layout */
	
	get_layout: function() {
		var ret = this.dom_get('layout', true, {
			'put_success': function() {
				$(this).hide();
			}
		});
		return ret;
	},
	
	/* Animation */
	
	animation_enabled: function() {
		return this.get_attribute('animate', true);
	},
	
	/* Overlay */
	
	/**
	 * Determine if overlay is enabled for viewer
	 * @return bool TRUE if overlay is enabled, FALSE otherwise
	 */
	overlay_enabled: function() {
		var ov = this.get_attribute('overlay_enabled');
		return ( this.util.is_bool(ov) ) ?  ov : false;
	},
	
	/**
	 * Retrieve overlay DOM element
	 * @return jQuery Overlay element (NULL if no overlay set for viewer)
	 */
	get_overlay: function() {
		console.groupCollapsed('Viewer.get_overlay');
		var o = null;
		console.log('Enabled: %o', this.overlay_enabled());
		if ( this.overlay_enabled() ) {
			o = this.dom_get('overlay', true, {
				'put_success': function() {
					$(this).hide();
				}
			});
		} else {
			console.warn('Problem with overlay');
		}
		console.groupEnd();
		return $(o);
	},
	
	unload: function() {
		
	},
	
	/**
	 * Reset viewer
	 */
	reset: function() {
		console.groupCollapsed('Viewer.reset');
		//Hide viewer
		this.dom_get().hide();
		//Restore DOM
		this.dom_restore();
		//History
		this.history_reset();
		//Item
		this.clear_item();
		//Reset properties
		this.set_active(false);
		this.set_loading(false);
		this.slideshow_stop();
		this.keys_disable();
		//Clear for next item
		this.get_status('item_working', true).resolve();
		console.groupEnd();
	},
	
	/* Content */
	
	get_labels: function() {
		return this.get_attribute('labels', {});
	},
	
	get_label: function(name) {
		var lbls = this.get_labels();
		return ( name in lbls ) ? lbls[name] : '';
	},
	
	/* Interactivity */
	
	/**
	 * Initialize event handlers upon opening lightbox
	 */
	events_open: function() {
		console.groupCollapsed('Viewer.events_open');
		//Keyboard bindings
		this.keys_enable();
		if ( this.open ) {
			console.warn('Event handlers previously set');
			console.groupEnd();
			return false;
		}
		
		//Control event bubbling
		var l = this.get_layout();
		l.children().click(function(ev) {
			ev.stopPropagation();
		});
		
		/* Close */
		var v = this;
		var close = function() {
			v.close();
		}
		//Layout
		l.click(close);
		//Overlay
		this.get_overlay().click(close);
		//Fire event
		this.trigger('events-open');
		console.groupEnd();
	},
	
	/**
	 * Initialize event handlers upon completing lightbox rendering
	 */
	events_complete: function() {
		console.groupCollapsed('Viewer.events_complete');
		if ( this.init ) {
			console.warn('Event handlers previously set');
			console.groupEnd();
			return false;
		}
		//Fire event
		this.trigger('events-complete');
		console.groupEnd();
	},
	
	keys_enable: function(mode) {
		if ( !this.util.is_bool(mode) ) {
			mode = true;
		}
		var e = ['keyup', this.util.get_prefix()].join('.');
		var v = this;
		var h = function(ev) {
			return v.keys_control(ev);
		}
		if ( mode ) {
			$(document).on(e, h);
		} else {
			$(document).off(e);
		}
	},
	
	keys_disable: function() {
		this.keys_enable(false);
	},
	
	keys_control: function(ev) {
		console.groupCollapsed('Viewer.keys_control');
		console.log('Code: %o', ev.which);
		var handlers = {
			27: this.close,
			37: this.item_prev,
			39: this.item_next
		};
		if ( ev.which in handlers ) {
			console.info('Handler found: %o', handlers[ev.which]);
			handlers[ev.which].call(this);
			console.groupEnd();
			return false;
		}
		console.groupEnd();
	},
		
	/**
	 * Check if slideshow functionality is enabled
	 * @return bool TRUE if slideshow is enabled, FALSE otherwise
	 */
	slideshow_enabled: function() {
		var o = this.get_attribute('slideshow_enabled');
		return ( this.util.is_bool(o) && o && this.get_item() && !this.get_item().get_group().is_single() ) ? true : false; 
	},
		
	/**
	 * Checks if slideshow is currently active
	 * @return bool TRUE if slideshow is active, FALSE otherwise
	 */
	slideshow_active: function() {
		return ( this.slideshow_enabled() && ( this.get_attribute('slideshow_active') || ( !this.init && this.get_attribute('slideshow_autostart') ) ) ) ? true : false;
	},
	
	/**
	 * Clear slideshow timer
	 */
	slideshow_clear_timer: function() {
		clearInterval(this.get_attribute('slideshow_timer'));
	},
	
	/**
	 * Start slideshow timer
	 * @param function callback Callback function
	 */
	slideshow_set_timer: function(callback) {
		this.set_attribute('slideshow_timer', setInterval(callback, this.get_attribute('slideshow_duration') * 1000));
	},
	
	/**
	 * Start Slideshow
	 */
	slideshow_start: function() {
		if ( !this.slideshow_enabled() ) {
			return false;
		}
		this.set_attribute('slideshow_active', true);
		this.dom_get().addClass('slideshow_active');
		//Clear residual timers
		this.slideshow_clear_timer();
		//Start timer
		var v = this;
		this.slideshow_set_timer(function() {
			//Pause slideshow until next item fully loaded
			v.slideshow_pause();
			
			//Show next item
			v.item_next();
		});
		this.trigger('slideshow-start');
	},
	
	/**
	 * Stop Slideshow
	 * @param bool full (optional) Full stop (TRUE) or pause (FALSE) (Default: TRUE)
	 */
	slideshow_stop: function(full) {
		if ( !this.util.is_bool(full) ) {
			full = true;
		}
		if ( full ) {
			this.set_attribute('slideshow_active', false);
			this.dom_get().removeClass('slideshow_active');
		}
		//Kill timers
		this.slideshow_clear_timer();
		this.trigger('slideshow-stop');
	},
	
	slideshow_toggle: function() {
		console.groupCollapsed('Viewer.slideshow_toggle');
		if ( !this.slideshow_enabled() ) {
			console.warn('Slideshow not enabled');
			console.groupEnd();
			return false;
		}
		if ( this.slideshow_active() ) {
			this.slideshow_stop();
		} else {
			this.slideshow_start();
		}
		this.trigger('slideshow-toggle');
		console.groupEnd();
	},
	
	/**
	 * Pause Slideshow
	 * @param bool mode (optional) Pause (TRUE) or Resume (FALSE) slideshow (default: TRUE)
	 */
	slideshow_pause: function(mode) {
		//Validate
		if ( !this.util.is_bool(mode) ) {
			mode = true;
		}
		//Set viewer slideshow properties
		if ( this.slideshow_active() ) {
			if ( !mode ) {
				//Slideshow resumed
				this.slideshow_start();
			} else {
				//Slideshow paused
				this.slideshow_stop(false);
			}
		}
		this.trigger('slideshow-pause');
	},
	
	/**
	 * Resume slideshow
	 */
	slideshow_resume: function() {
		this.slideshow_pause(false);
	},
	
	/**
	 * Next item
	 */
	item_next: function() {
		var g = this.get_item().get_group(true);
		var v = this;
		var ev = 'item-next';
		var st = ['events', 'viewer', ev].join('_');
		//Setup event handler
		if ( !g.get_status(st) ) {
			g.set_status(st);
			g.on(ev, function(e) {
				v.trigger(e.type);
			});
		}
		g.show_next();
	},
	
	/**
	 * Previous item
	 */
	item_prev: function() {
		var g = this.get_item().get_group(true);
		var v = this;
		var ev = 'item-prev';
		var st = ['events', 'viewer', ev].join('_');
		if ( !g.get_status(st) ) {
			g.set_status(st);
			g.on(ev, function() {
				v.trigger(ev);
			});
		}
		g.show_prev();
	},
	
	/**
	 * Close viewer
	 */
	close: function() {
		console.groupCollapsed('Viewer.close');
		//Deactivate
		this.set_active(false);
		var v = this;
		var thm = this.get_theme();
		thm.transition('unload')
			.always(function() {
				thm.transition('close', true).always(function() {
					//End processes
					v.reset();
					v.trigger('close');
				});
			})
			.fail(function() {
				thm.dom_get_tag('item', 'content').attr('style', '');
			});
		console.groupEnd();
		return false;
	}
};

View.Viewer = Component.extend(Viewer);

/**
 * Content group
 * @param obj options Init options
 */
var Group = {
	/* Configuration */
	
	_slug: 'group',
	_reciprocal: true,
	_refs: {
		'current': 'Content_Item'
	},
	
	/* References */
	
	current: null,
	
	/* Properties */
	
	/**
	 * Selector for getting group items
	 * @var string 
	 */
	selector: null,
	
	/* Methods */
	
	/* Init */
	
	register_hooks: function() {
		var t = this;
		this.on(['item-prev', 'item-next'], function() {
			t.trigger('item-change');
		});
	},
	
	/* Properties */
	
	/**
	 * Retrieve selector for group items
	 * @return string Group items selector 
	 */
	get_selector: function() {
		console.groupCollapsed('Group.get_selector');
		if ( this.util.is_empty(this.selector) ) {
			//Build selector
			this.selector = 'a[%s="%s"]'.sprintf(this.dom_get_attribute(), this.get_id());
			console.info('Selector: %o', this.selector);
		}
		console.groupEnd();
		return this.selector;
	},
	
	/**
	 * Retrieve group items
	 */
	get_items: function() {
		console.groupCollapsed('Group.get_items');
		var items = ( !this.util.is_empty(this.get_id()) ) ? $(this.get_selector()) : this.get_current().dom_get();
		console.log('Items (%o): %o', items.length, items);
		console.groupEnd();
		return items;
	},
	
	/**
	 * Retrieve item at specified index
	 * If no index specified, first item is returned
	 * @param int idx Index of item to return
	 * @return Content_Item Item
	 */
	get_item: function(idx) {
		console.groupCollapsed('Group.get_item: %o', idx);
		//Validation
		if ( !this.util.is_int(idx) ) {
			idx = 0;
		}
		//Retrieve all items
		var items = this.get_items();
		//Validate index
		var max = this.get_size() - 1;
		if ( idx > max ) {
			idx = max;
		}
		//Return specified item
		console.groupEnd();
		return items.get(idx);
	},
	
	/**
	 * Retrieve (zero-based) position of specified item in group
	 * @param Content_Item item Item to locate in group
	 * @return int Index position of item in group (-1 if item not in group)
	 */
	get_pos: function(item) {
		if ( this.util.is_empty(item) ) {
			//Get current item
			item = this.get_current();
		}
		return ( this.util.is_type(item, View.Content_Item) ) ? this.get_items().index(item.dom_get()) : -1;
	},
	
	/**
	 * Retrieve current item
	 * @return Content_Item Current item
	 */
	get_current: function() {
		//Sanitize
		if ( !this.util.is_empty(this.current) && !this.util.is_type(this.current, View.Content_Item) ) {
			console.warn('Resetting current item: %o', this.current);
			this.current = null;
		}
		console.log('Current: %o', this.current);
		return this.current;
	},
	
	/**
	 * Sets current group item
	 * @param Content_Item item Item to set as current
	 */
	set_current: function(item) {
		console.groupCollapsed('Group.set_current');
		console.log('Item: %o', item);
		//Validate
		if ( this.util.is_type(item, View.Content_Item) ) {
			//Set current item
			console.log('Setting current item');
			this.current = item;
		}
		console.groupEnd();
	},
		
	get_next: function(item) {
		console.groupCollapsed('Group.get_next');
		//Validate
		if ( !this.util.is_type(item, View.Content_Item) ) {
			console.log('Retrieving current item');
			item = this.get_current();
		}
		if ( this.get_size() == 1 ) {
			console.warn('Single item in group');
			console.groupEnd();
			return item;
		}
		var next = null;
		var pos = this.get_pos(item);
		if ( pos != -1 ) {
			pos = ( pos + 1 < this.get_size() ) ? pos + 1 : 0;
			next = this.get_item(pos);
		}
		console.log('Position in Group: %o \nItem: %o', pos, next);
		console.groupEnd();
		return next;
	},
	
	get_prev: function(item) {
		console.groupCollapsed('Group.get_prev');
		//Validate
		if ( !this.util.is_type(item, View.Content_Item) ) {
			console.log('Retrieving current item');
			item = this.get_current();
		}
		if ( this.get_size() == 1 ) {
			console.warn('Single item in group');
			console.groupEnd();
			return item;
		}
		var prev = null;
		var pos = this.get_pos(item);
		if ( pos != -1 ) {
			if ( pos == 0 ) {
				pos = this.get_size();
			}
			pos -= 1;
			prev = this.get_item(pos);
		}
		console.log('Position in Group: %o \nItem: %o', pos, prev);
		console.groupEnd();
		return prev;
	},
	
	show_next: function(item) {
		console.groupCollapsed('Group.show_next');
		if ( this.get_size() > 1 ) {
			//Retrieve item
			var i = this.get_parent().get_item(this.get_next(item));
			//Update current item
			this.set_current(i);
			//Show item
			i.show();
			//Fire event
			this.trigger('item-next');
		}
		console.groupEnd();
	},
	
	show_prev: function(item) {
		console.groupCollapsed('Group.show_prev');
		if ( this.get_size() > 1 ) {
			//Retrieve item
			var i = this.get_parent().get_item(this.get_prev(item));
			//Update current item
			this.set_current(i);
			//Show item
			i.show();
			//Fire event
			this.trigger('item-prev');
		}
		console.groupEnd();
	},
	
	/**
	 * Retrieve total number of items in group
	 * @return int Number of items in group 
	 */
	get_size: function() {
		return this.get_items().length;
	},
	
	is_single: function() {
		return ( this.get_size() == 1 );
	}
};

View.Group = Component.extend(Group);

/**
 * Content Handler
 * @param obj options Init options
 */
var Content_Handler = {
	
	/* Configuration */
	
	_slug: 'content_handler',
	_refs: {
		'item': 'Content_Item'
	},
	
	/* References */
	
	item: null,
	
	/* Properties */
	
	/**
	 * Raw layout template
	 * @var string 
	 */
	template: '',
	
	/* Methods */
	
	/* Item */
	
	/**
	 * Check if item instance set for type
	 * @uses get_item()
	 * @uses clear_item() to remove invalid item values
	 * @return bool TRUE if valid item set, FALSE otherwise
	 */
	has_item: function() {
		return ( this.util.is_empty(this.get_item()) ) ? false : true;
	},
	
	/**
	 * Retrieve item instance set on type
	 * @uses get_component()
	 * @return mixed Content_Item if valid item set, NULL otherwise
	 */
	get_item: function() {
		return this.get_component('item', true, false);
	},
	
	/**
	 * Set item instance for type
	 * Items are only meant to be set/used while item is being processed
	 * @uses set_component()
	 * @param Content_Item item Item instance
	 * @return obj|null Item instance if item successfully set, NULL otherwise
	 */
	set_item: function(item) {
		//Set reference
		var r = this.set_component('item', item);
		return r;
	},
	
	/**
	 * Clear item instance from type
	 * Sets value to NULL
	 */
	clear_item: function() {
		this.item = null;
	},
	
	/* Evaluation */
		
	/**
	 * Check if item matches content handler
	 * @param object item Content_Item instance to check for type match
	 * @return bool TRUE if type matches, FALSE otherwise 
	 */
	match: function(item) {
		console.groupCollapsed('Content_Handler.match');
		//Validate
		var attr = 'match';
		var m = this.get_attribute(attr);
		//Stop processing types with no matching algorithm
		if ( !this.util.is_empty(m) ) {
			//Process regex patterns
			
			//String-based
			if ( this.util.is_string(m) ) {
				//Create new regexp object
				console.log('Processing string regex');
				m = new RegExp(m, "i");
				this.set_attribute(attr, m);
			}
			//RegExp based
			if ( this.util.is_type(m, RegExp) ) {
				console.info('Checking regex: %o \nMatch: %o', m, m.test(item.get_uri()));
				console.groupEnd();
				return m.test(item.get_uri());
			}
			//Process function
			if ( this.util.is_func(m) ) {
				console.info('Processing match function');
				console.groupEnd();
				return ( m.call(this, item) ) ? true : false;
			}
		}
		//Default
		console.warn('No match algorithm');
		console.groupEnd();
		return false;
	},
	
	/* Processing/Output */
	
	/**
	 * Render output to display item
	 * @param Content_Item item Item to render output for
	 * @return obj jQuery.Promise that is resolved when item is rendered
	 */
	render: function(item) {
		console.groupCollapsed('Content_Handler.render');
		var dfr = $.Deferred();
		//Validate
		var ret = this.call_attribute('render', item);
		if ( this.util.is_promise(ret) ) {
			ret.done(function(output) {
				dfr.resolve(output);
			});
		} else {
			//String format
			if ( this.util.is_string(ret) ) {
				console.log('Processing string format');
				ret = ret.sprintf(item.get_uri());
			}
			//Resolve deferred immediately
			dfr.resolve(ret);
		}
		console.groupEnd();
		return dfr.promise();
	}
};

View.Content_Handler = Component.extend(Content_Handler);

/**
 * Content Item
 * @param obj options Init options
 */
var Content_Item = {
	/* Configuration */
	
	_slug: 'content_item',
	_reciprocal: true,
	_refs: {
		'viewer': 'Viewer',
		'group': 'Group',
		'type': 'Content_Handler'
	},
	_containers: ['group'],
	
	_attr_default: {
		source: null,
		permalink: null,
		dimensions: null,
		title: '',
		group: null,
		internal: false,
		output: null
	},
	
	/* References */
	
	group: null,
	viewer: null,
	type: null,
	
	/* Properties */
	
	data: null,
	
	/* Init */
	
	_c: function(el) {
		console.info('New Content Item');
		//Save element to instance
		this.dom_set(el);
		//Default initialization
		this._super();
	},
	
	/* Methods */
	
	/*-** Attributes **-*/
	
	/**
	 * Build default attributes
	 * Populates attributes with asset properties (attachments)
	 * Overrides super class method
	 * @uses Component.init_default_attributes()
	 */
	init_default_attributes: function() {
		console.groupCollapsed('Content_Item.init_default_attributes');
		this._super();
		//Add asset properties
		var d = this.dom_get();
		var key = d.attr('href') || null;
		var assets = this.get_parent().assets || null;
		console.log('Key: %o \nAssets: %o', key, assets);
		//Merge asset data with default attributes
		if ( this.util.is_string(key) ) {
			var attrs = [{}, this._attr_default, {'permalink': key}];
			if ( this.util.is_obj(assets) ) {
				var t = this;
				var get_assets = function(key, raw) {
					var ret = {};
					if ( key in assets && t.util.is_obj(assets[key]) ) {
						var ret = assets[key];
						if ( t.util.is_string(raw) ) {
							var e = '_entries';
							if ( !( e in ret ) || ret[e].indexOf(raw) == -1 ) {
								console.warn('No match for raw key found: %o / %o', key, raw);
								console.dir(ret[e]);
								ret = {};
							}
						}
					}
					return ret;
				};
				var asset = get_assets(key);
				if ( this.util.is_empty(asset) && ( kpos = key.indexOf('?') ) && kpos != -1 ) {
					var key_base = key.substr(0, kpos);
					asset = get_assets(key_base, key); 
				}
				console.dir(asset);
				if ( !this.util.is_empty(asset) ) {
					attrs.push(asset);
				}
			}
			this._attr_default = $.extend.apply(this, attrs);
			console.log('Default Attributes Updated: %o', this._attr_default);
		}
		console.groupEnd();
		return this._attr_default;
	},
	
	/*-** Properties **-*/
	
	/**
	 * Retrieve item output
	 * Output generated based on content handler if not previously generated
	 * @uses get_attribute() to retrieve cached output
	 * @uses set_attribute() to cache generated output
	 * @uses get_type() to retrieve item type
	 * @uses Content_Handler.render() to generate item output
	 * @return obj jQuery.Promise that is resolved when output is retrieved
	 */
	get_output: function() {
		console.groupCollapsed('Item.get_output');
		console.info('Checking for cached output');
		var dfr = $.Deferred();
		//Check for cached output
		var ret = this.get_attribute('output');
		if ( this.util.is_string(ret) ) {
			dfr.resolve(ret);
		} else if ( this.has_type() ) {
			//Render output from scratch (if necessary)
			console.info('Rendering output');
			console.info('Get item type');
			//Get item type
			var type = this.get_type();
			console.log('Item type: %o', type);
			//Render type-based output
			var item = this;
			type.render(this).done(function(output) {
				console.info('Output Retrieved: %o', output);
				console.info('Caching item output');
				//Cache output
				item.set_output(output);
				dfr.resolve(output);
			});
		} else {
			dfr.resolve('');
		}
		console.groupEnd();
		return dfr.promise();
	},
	
	/**
	 * Cache output for future retrieval
	 * @uses set_attribute() to cache output
	 */
	set_output: function(out) {
		console.groupCollapsed('Item.set_output: %o', out);
		if ( this.util.is_string(out, false) ) {
			this.set_attribute('output', out);
		}
		console.groupEnd();
	},
	
	/**
	 * Retrieve item output
	 * Alias for `get_output()`
	 * @return jQuery.Promise Deferred that is resolved when content is retrieved 
	 */
	get_content: function() {
		return this.get_output();
	},
	
	/**
	 * Retrieve item URI
	 * @param string mode (optional) Which URI should be retrieved
	 * > source: Media source
	 * > permalink: Item permalink
	 * @return string Item URI
	 */
	get_uri: function(mode) {
		console.groupCollapsed('Item.get_uri');
		//Validate
		if ( $.inArray(mode ,['source', 'permalink']) == -1 ) {
			mode = 'source';
		}
		console.log('Mode: %o', mode);
		//Retrieve URI
		var ret = this.get_attribute(mode);
		if ( !this.util.is_string(ret) ) {
			ret = ( 'source' == mode ) ? this.get_attribute('permalink') : '';
		}
		console.log('Item URI: %o', ret);
		console.groupEnd();
		return ret;
	},
	
	get_title: function() {
		//Check saved attributes
		var props = ['caption', 'title'];
		var title = '';
		for ( var x = 0; x < props.length; x++ ) {
			title = this.get_attribute(props[x]);
			if ( this.util.is_string(title) ) {
				return title;
			}
		}
		
		//Generate title from item metadata
		var prop = 'title';
		var dom = this.dom_get();
		
		//Caption
		if ( dom.length ) {
			var sel = '.wp-caption-text';
			title = ( this.in_gallery('wp') ) ? dom.parent().siblings(sel).html() : dom.siblings(sel).html(); 
		
			//Image title
			if ( !title ) {
				var img = dom.find('img').first();
				title = $(img).attr('title') || $(img).attr('alt');
			}
			
			//DOM element title
			if ( !title ) {
				title = dom.attr(prop);
			}
			
			//Element text
			if ( !title ) {
				title = dom.text();
			}
		}
		
		//Validate
		if ( !this.util.is_string(title) ) {
			title = '';
		}
		
		//Return value
		this.set_attribute(prop, title);
		return title;
	},
	
	/**
	 * Retrieve item dimensions
	 * @return obj Item `width` and `height` properties (px) 
	 */
	get_dimensions: function() {
		return $.extend({'width': 0, 'height': 0}, this.get_attribute('dimensions'), {});
	},
	
	/**
	 * Save item data to instance
	 * Item data is saved when rendered
	 * @param mixed data Item data (property cleared if NULL)
	 */
	set_data: function(data) {
		this.data = data;
	},
	
	/**
	 * Check if current link is part of a gallery
	 * @param obj item
	 * @param string gType Gallery type to check for
	 * @return bool TRUE if link is part of a gallery (FALSE otherwise)
	 */
	in_gallery: function(gType) {
		var ret = false;
		var galls = {
			'wp': '.gallery-icon',
			'ng': '.ngg-gallery-thumbnail'
		};
		
		if ( typeof gType == 'undefined' || !(gType in galls) ) {
			gType = 'wp';
		}
		return ( this.dom_get().parent(galls[gType]).length > 0 ) ? true : false ;
	},
	
	/*-** Component References **-*/
	
	/* Viewer */
	
	get_viewer: function() {
		return this.get_component('viewer');
	},
	
	/**
	 * Sets item's viewer property
	 * @uses View.get_viewer() to retrieve global viewer
	 * @uses this.viewer to save item's viewer
	 * @param string|View.Viewer v Viewer to set for item
	 *  > Item's viewer is reset if invalid viewer provided
	 */
	set_viewer: function(v) {
		return this.set_component('viewer', v);
	},
	
	/* Group */

	/**
	 * Retrieve item's group
	 * @param bool set_current (optional) Sets item as current item in group (Default: FALSE)
	 * @return View.Group|bool Group reference item belongs to (FALSE if no group)
	 */
	get_group: function(set_current) {
		console.groupCollapsed('Item.get_group');
		var prop = 'group';
		//Check if group reference already set
		var g = this.get_component(prop, true, false, false);
		if ( g ) {
			console.log('Group: %o', g);
		} else {
			console.warn('No group reference: %o', g);
			//Set empty group if no group exists
			g = this.set_component(prop, new View.Group());
			set_current = true;
		}
		if ( !!set_current ) {
			g.set_current(this);
		}
		console.groupEnd();
		return g;
	},
	
	/**
	 * Sets item's group property
	 * @uses View.get_group() to retrieve global group
	 * @uses this.group to set item's group
	 * @param string|View.Group g Group to set for item
	 *  > Item's group is reset if invalid group provided
	 */
	set_group: function(g) {
		console.groupCollapsed('Item.set_group');
		console.log('Group: %o', g);
		//If group ID set, get object reference
		if ( this.util.is_string(g) ) {
			g = this.get_parent().get_group(g);
		}
		
		//Set (or clear) group property
		this.group = ( this.util.is_type(g, View.Group) ) ? g : false;
		console.groupEnd();
	},
	
	/* Content Handler */
	
	/**
	 * Retrieve item type
	 * @uses get_component() to retrieve saved reference to Content_Handler instance
	 * @uses View.get_content_handler() to determine item content handler (if necessary)
	 * @return Content_Handler|null Content Handler of item (NULL no valid type exists)
	 */
	get_type: function() {
		console.groupCollapsed('Item.get_type');
		console.info('Retrieving saved type reference');
		var t = this.get_component('type', false, false, false);
		if ( !t ) {
			console.info('No type reference, getting type from Controller');
			t = this.set_type(this.get_parent().get_content_handler(this));
		}
		console.info('Type: %o', t);
		console.groupEnd();
		return t;
	},
	
	/**
	 * Save content handler reference
	 * @uses set_component() to save type reference
	 * @return Content_Handler|null Saved content handler (NULL if invalid)
	 */
	set_type: function(type) {
		return this.set_component('type', type);
	},
	
	/**
	 * Check if content handler exists for item
	 * @return bool TRUE if content handler exists, FALSE otherwise
	 */
	has_type: function() {
		console.groupCollapsed('Item.has_type');
		var ret = !this.util.is_empty(this.get_type());
		console.groupEnd();
		return ret;
	},
	
	/* Actions */
	
	/**
	 * Display item in viewer
	 * @uses get_viewer() to retrieve viewer instance for item
	 * @uses Viewer.show() to display item in viewer
	 * @param obj options (optional) Options
	 */
	show: function(options) {
		console.group('Item.show');
		//Validate content handler
		if ( !this.has_type() ) {
			console.warn('Item has invalid type');
			console.groupEnd();
			return false;
		}
		console.info('Valid type');
		//Set display options
		this.set_attribute('options_show', options);
		//Retrieve viewer
		var v = this.get_viewer();
		console.info('Viewer retrieved: %o', v);
		//Load item
		var ret = v.show(this);
		console.groupEnd();
		return ret;
	},
	
	reset: function() {
		this.set_attribute('options_show', null);
	}
};

View.Content_Item = Component.extend(Content_Item);

/**
 * Modeled Component
 */
var Modeled_Component = {
	
	_slug: 'modeled_component',
	
	/* Methods */
	
	/* Attributes */
	
	/**
	 * Retrieve attribute
	 * Gives priority to model values
	 * @see Component.get_attribute()
	 * @param string key Attribute to retrieve
	 * @param mixed def (optional) Default value (Default: NULL)
	 * @param bool check_model (optional) Check model for value (Default: TRUE)
	 * @param bool enforce_type (optional) Return value data type should match default value data type (Default: TRUE)
	 * @return mixed Attribute value
	 */
	get_attribute: function(key, def, check_model, enforce_type) {
		//Validate
		if ( !this.util.is_string(key) ) {
			//Invalid requests sent straight to super method
			return this._super(key, def, enforce_type);
		}
		if ( !this.util.is_bool(check_model) ) {
			check_model = true;
		}
		var ret = null;
		//Check model for attribute
		if ( check_model ) {
			var m = this.get_ancestor(key, false);
			if ( this.util.in_obj(m, key) ) {
				ret = m[key];
			}
		}
		//Check standard attributes as fallback
		if ( null == ret ) {
			ret = this._super(key, def, enforce_type);
		}
		return ret;
	},

	/**
	 * Set attribute value
	 * Gives priority to model values
	 * @see Component.set_attribute()
	 * @param string key Attribute to set
	 * @param mixed val Value to set for attribute
	 * @param bool|obj use_model (optional) Set the value on the model (Default: TRUE)
	 * > bool: Set attribute on current model (TRUE) or as standard attribute (FALSE) 
	 * > obj: Model object to set attribute on
	 * @return mixed Attribute value
	 */
	set_attribute: function(key, val, use_model) {
		console.groupCollapsed('Modeled_Component.set_attribute');
		console.log('Key: %o \nValue: %o', key, val);
		//Validate
		if ( ( !this.util.is_string(key) ) || !this.util.is_set(val) ) {
			console.warn('Invalid request');
			console.groupEnd();
			return false;
		}
		if ( !this.util.is_bool(use_model) && !this.util.is_obj(use_model) ) {
			use_model = true;
		}
		//Determine where to set attribute
		if ( !!use_model ) {
			console.info('Setting model attribute: %o', this.get_model());
			var model = this.util.is_obj(use_model) ? use_model : this.get_model();
			
			//Set attribute in model
			model[key] = val;
		} else {
			//Set as standard attribute
			this._super(key, val);
		}
		console.groupEnd();
		return val;
	},

	
	/* Model */
	
	/**
	 * Retrieve Template model
	 * @return obj Model (Default: Empty object)
	 */
	get_model: function() {
		var m = this.get_attribute('model', null, false);
		if ( !this.util.is_obj(m) ) {
			//Set default value
			m = {};
			this.set_attribute('model', m, false);
		}
		return m;
	},


	/**
	 * Check if instance has model
	 * @return bool TRUE if model is set, FALSE otherwise
	 */
	has_model: function() {
		return ( this.util.is_empty( this.get_model() ) ) ? false : true;
	},


	
	/**
	 * Check if specified attribute exists in model
	 * @param string key Attribute to check for
	 * @return bool TRUE if attribute exists, FALSE otherwise
	 */
	in_model: function(key) {
		return ( this.util.in_obj(this.get_model(), key) ) ? true : false;
	},
	
	/**
	 * Retrieve all ancestor models
	 * @param bool inc_current (optional) Include current model in list (Default: FALSE)
	 * @return array Theme ancestor models (Closest parent first)
	 */
	get_ancestors: function(inc_current) {
		var ret = [];
		var m = this.get_model();
		while ( this.util.is_obj(m) ) {
			ret.push(m);
			m = ( this.util.in_obj(m, 'parent') && this.util.is_obj(m.parent) ) ? m.parent : null;
		}
		//Remove current model from list
		if ( !inc_current ) {
			ret.shift();
		}
		return ret;
	},
	
	/**
	 * Retrieve first ancestor of current theme with specified attribute
	 * > Current model is also evaluated
	 * @param string attr Attribute to search ancestors for
	 * @param bool safe_mode (optional) Return current model if no matching ancestor found (Default: TRUE)
	 * @return obj Theme ancestor (Default: Current theme model)
	 */
	get_ancestor: function(attr, safe_mode) {
		//Validate
		if ( !this.util.is_string(attr) ) {
			return false;
		}
		if ( !this.util.is_bool(safe_mode) ) {
			safe_mode = true;
		}
		var mcurr;
		var m = mcurr = this.get_model();
		var found = false;
		while ( this.util.is_obj(m) ) {
			//Check if attribute exists in model
			if ( this.util.in_obj(m, attr) && !this.util.is_empty(m[attr]) ) {
				found = true;
				break;
			}
			//Get next model
			m = ( this.util.in_obj(m, 'parent') ) ? m['parent'] : null;
		}
		if ( !found ) {
			if ( safe_mode ) {
				//Use current model as fallback
				if ( this.util.is_empty(m) ) {
					m = mcurr;
				}
				//Add attribute to object
				if ( !this.util.in_obj(m, attr) ) {
					m[attr] = null;
				}
			} else {
				m = null;
			}
		}
		return m;
	}

};

Modeled_Component = Component.extend(Modeled_Component);

/**
 * Theme
 */
var Theme = {
	
	/* Configuration */
	
	_slug: 'theme',
	_refs: {
		'viewer': 'Viewer',
		'template': 'Template'
	},
	_models: {},
	
	_containers: ['viewer'],
	
	_attr_default: {
		template: null,
		model: null
	},
	
	/* References */
	
	viewer: null,
	template: null,
	
	/* Methods */
	
	/**
	 * Custom constructor
	 * @see Component._c()
	 */
	_c: function(id, attributes, viewer) {
		console.groupCollapsed('Theme.Constructor');
		//Validate
		if ( arguments.length == 1 && this.util.is_type(arguments[0], View.Viewer) ) {
			viewer = arguments[0];
			id = null;
		}
		//Pass parameters to parent constructor
		this._super(id, attributes);
		
		//Set viewer instance
		this.set_viewer(viewer);
		
		//Set theme model
		this.set_model(id);
		console.groupEnd();
	},
	
	/* Viewer */
	
	get_viewer: function() {
		return this.get_component('viewer', false, true, false);
	},
	
	/**
	 * Sets theme's viewer property
	 * @uses View.get_viewer() to retrieve global viewer
	 * @uses this.viewer to save item's viewer
	 * @param string|View.Viewer v Viewer to set for item
	 *  > Theme's viewer is reset if invalid viewer provided
	 */
	set_viewer: function(v) {
		return this.set_component('viewer', v);
	},
	
	/* Template */
	
	/**
	 * Retrieve template instance
	 * @return Template instance
	 */
	get_template: function() {
		console.groupCollapsed('Theme.get_template');
		//Get saved template
		var ret = this.get_component('template', true, false, false);
		//Template needs to be initialized
		if ( this.util.is_empty(ret) ) {
			//Pass model to Template instance
			var attr = { 'theme': this, 'model': this.get_model() };
			ret = this.set_component('template', new View.Template(attr));
		}
		console.groupEnd();
		return ret;
	},
	
	/**
	 * Retrieve tags from template
	 * All tags will be retrieved by default
	 * Specific tag/property instances can be retrieved as well
	 * @see Template.get_tags()
	 * @param string name (optional) Name of tags to retrieve
	 * @param string prop (optional) Specific tag property to retrieve
	 * @return array Tags in template
	 */
	get_tags: function(name, prop) {
		return this.get_template().get_tags(name, prop);
	},
	
	/**
	 * Retrieve tag DOM elements
	 * @see Template.dom_get_tag()
	 */
	dom_get_tag: function(tag, prop) {
		return $(this.get_template().dom_get_tag(tag, prop));
	},
	
	/* Model */
	
	/**
	 * Retrieve theme models
	 * @return obj Theme models
	 */
	get_models: function() {
		return this._models;
	},
	
	/**
	 * Retrieve specified theme model
	 * @param string id (optional) Theme model to retrieve
	 * > Default model retrieved if ID is invalid/not set
	 * @return obj Specified theme model
	 */
	get_model: function(id) {
		var ret = null;
		//Pass request to superclass method
		if ( !this.util.is_set(id) && this.util.is_obj( this.get_attribute('model', null, false) ) ) {
			ret = this._super();
		} else {
			//Retrieve matching theme model
			var models = this.get_models();
			if ( !this.util.is_string(id) ) {
				var id = this.get_parent().get_option('theme_default');
			}
			//Select first theme model if specified model is invalid
			if ( !this.util.in_obj(models, id) ) {
				id = Object.keys(models)[0];
			}
			ret = models[id];
		}
		return ret;
	},
	
	/**
	 * Set model for current theme instance
	 * @param string id (optional) Theme ID (Default theme retrieved if ID invalid)
	 */
	set_model: function(id) {
		this.set_attribute('model', this.get_model(id), false);
		//Set ID using model attributes (if necessary)
		if ( !this.check_id(true) ) {
			var m = this.get_model();
			if ( 'id' in m ) {
				this.set_id(m.id);
			}
		}
	},
	
	/* Properties */
	
	/**
	 * Generate class names for DOM node
	 * @param string rtype (optional) Return data type
	 *  > Default: array
	 *  > If string supplied: Joined classes delimited by parameter
	 * @uses get_class() to generate class names
	 * @uses Array.join() to convert class names array to string
	 * @return array Class names
	 */
	get_classes: function(rtype) {
		//Build array of class names
		var cls = [];
		var thm = this;
		//Include theme parent's class name
		var models = this.get_ancestors(true);
		$.each(models, function(idx, model) {
			cls.push(thm.add_ns(model.id));
		});
		//Convert class names array to string
		if ( this.util.is_string(rtype) ) {
			cls = cls.join(rtype);
		}
		//Return class names
		return cls;
	},
	
	/**
	 * Get custom measurement
	 * @param string attr Measurement to retrieve
	 * @param obj def (optional) Default value
	 * @return obj Attribute measurements
	 */
	get_measurement: function(attr, def) {
		console.groupCollapsed('Theme.get_measurement (%o)', attr);
		var meas = null;
		//Validate
		if ( !this.util.is_string(attr) ) {
			console.groupEnd();
			return meas;	
		}
		if ( !this.util.is_obj(def, false) ) {
			def = {};
		}
		//Manage cache
		var attr_cache = '%s_cache'.sprintf(attr); 
		var cache = this.get_attribute(attr_cache, {}, false);
		var status = '_status';
		var item = this.get_viewer().get_item();
		var w = $(window);
		//Check cache freshness
		if ( !( status in cache ) || !this.util.is_obj(cache[status]) || cache[status].width != w.width() || cache[status].height != w.height() ) {
				console.warn('Resetting cache');
				cache = {};
		}
		if ( this.util.is_empty(cache) ) {
			//Set status
			cache[status] = {
				'width': w.width(),
				'height': w.height(),
				'index': []
			};
		}
		//Retrieve cached values
		var pos = cache[status].index.indexOf(item);
		if ( pos != -1 && pos in cache ) {
			console.info('Retrieving cached data: %o \n%o', pos, cache[pos]);
			meas = cache[pos];
		}
		//Generate measurement
		if ( !this.util.is_obj(meas) ) {
			console.info('Generating offsets');
			//Get custom theme measurement
			meas = this.call_attribute(attr);
			if ( !this.util.is_obj(meas) ) {
				//Retrieve fallback value
				meas = this.get_measurement_default(attr);
				console.warn('Fallback measurement: %o', meas);
			}
		}
		//Normalize measurement
		meas = ( this.util.is_obj(meas) ) ? $.extend({}, def, meas) : def;
		//Cache measurement
		pos = cache[status].index.push(item) - 1;
		cache[pos] = meas;
		this.set_attribute(attr_cache, cache, false);
		console.log('Measurement cached: %o', meas);
		console.groupEnd();
		//Return measurement (copy)
		return $.extend({}, meas);
	},
	
	/**
	 * Get default measurement using attribute's default handler
	 * @param string attr Measurement attribute
	 * @return obj Measurement values
	 */
	get_measurement_default: function(attr) {
		//Validate
		if ( !this.util.is_string(attr) ) {
			return null;
		}
		//Find default handler
		attr = 'get_%s_default'.sprintf(attr);
		if ( this.util.in_obj(this, attr) ) {
			attr = this[attr];
			if ( this.util.is_func(attr) ) {
				//Execute default handler
				attr = attr.call(this);
			}
		} else {
			attr = null;
		}
		return attr;
	},
	
	/**
	 * Retrieve theme offset
	 * @return obj Theme offset with `width` & `height` properties
	 */
	get_offset: function() {
		return this.get_measurement('offset', { 'width': 0, 'height': 0});
	},
	
	/**
	 * Generate default offset
	 * @return obj Theme offsets with `width` & `height` properties
	 */
	get_offset_default: function() {
		console.groupCollapsed('Theme.get_offset_default');
		var offset = { 'width': 0, 'height': 0 };
		var v = this.get_viewer();
		var vn = v.dom_get();
		//Clone viewer
		var vc = vn
			.clone()
			.attr('id', '')
			.css({'visibility': 'hidden', 'position': 'absolute', 'top': ''})
			.removeClass('loading')
			.appendTo(vn.parent());
		console.log('Cloned viewer', vc);
		//Get offset from layout node
		var l = vc.find(v.dom_get_selector('layout'));
		console.info('Layout (%o): %o \nHeight: %o \nWidth: %o', v.dom_get_selector('layout'), l, l.height(), l.width());
		if ( l.length ) {
			//Clear inline styles
			l.find('*').css({
				'width': '',
				'height': '',
				'display': ''
			});
			//Resize content nodes
			console.group('Resizing content tag');
			var tags = this.get_tags('item', 'content');
			if ( tags.length ) {
				var offset_item = v.get_item().get_dimensions();
				//Set content dimensions
				tags = $(l.find(tags[0].get_selector('full')).get(0)).css({'width': offset_item.width, 'height': offset_item.height});
				$.each(offset_item, function(key, val) {
					offset[key] = -1 * val;
				});
			}
			
			//Set offset
			offset.width += l.width();
			offset.height += l.height();
			//Normalize
			$.each(offset, function(key, val) {
				if ( val < 0 ) {
					offset[key] = 0;
				}
			});
			console.groupEnd();
		}
		console.info('Layout\nWidth: %o \nHeight: %o \nCalculated offsets: %o', l.width(), l.height(), offset);
		vc.empty().remove();
		console.groupEnd();
		return offset;
	},
	
	/**
	 * Retrieve theme margins
	 * @return obj Theme margin with `width` & `height` properties 
	 */
	get_margin: function() {
		return this.get_measurement('margin', {'width': 0, 'height': 0});
	},
	
	/**
	 * Retrieve item dimensions
	 * Dimensions are adjusted to fit window (if necessary)
	 * @return obj Item dimensions with `width` & `height` properties
	 */
	get_item_dimensions: function() {
		console.groupCollapsed('Theme.get_item_dimensions()');
		var v = this.get_viewer();
		var dims = v.get_item().get_dimensions();
		console.info('Original dimensions: %o \nAutofit: %o', dims, v.get_attribute('autofit'));
		if ( v.get_attribute('autofit', false) ) {
			console.log('Processing resize');
			//Get maximum dimensions
			var margin = this.get_margin();
			var offset = this.get_offset();
			offset.height += margin.height;
			offset.width += margin.width;
			var max =  {'width': $(window).width(), 'height': $(window).height() };
			if ( max.width > offset.width ) {
				max.width -= offset.width;
			}
			if ( max.height > offset.height ) {
				max.height -= offset.height;
			}
			//Get resize factor
			var factor = Math.min(max.width / dims.width, max.height / dims.height);
			console.info('Offset: %o \nMax: %o \nFactor: %o', offset, max, factor);
			//Resize dimensions
			if ( factor < 1 ) {
				console.log('Resizing');
				$.each(dims, function(key, val) {
					dims[key] = Math.round(dims[key] * factor);
				});
				console.info('Resized: %o', dims);
			}
		}
		console.info('Final dimensions: %o', dims);
		console.groupEnd();
		return $.extend({}, dims);
	},
	
	/**
	 * Retrieve theme dimensions
	 * @return obj Theme dimensions with `width` & `height` properties
	 */
	get_dimensions: function() {
		var dims = this.get_item_dimensions();
		var offset = this.get_offset();
		$.each(dims, function(key, val) {
			dims[key] += offset[key];
		});
		return dims;
	},
	
	/* Output */
	
	/**
	 * Render Theme output
	 * @param bool init (optional) Initialize theme (Default: FALSE)
	 * @see Template.render()
	 */
	render: function(init) {
		console.group('Theme.render');
		var thm = this;
		var tpl = this.get_template();
		var st = 'events_render';
		if ( !this.get_status(st) ) {
			this.set_status(st);
			//Register events
			tpl.on([
				'render-init',
				'render-loading',
				'render-complete'
				],
				function(ev) {
					return thm.trigger(ev.type, ev.data);
				});
		}
		//Render template
		tpl.render(init);
		console.groupEnd();
	},
	
	transition: function(event, clear_queue) {
		console.groupCollapsed('Theme.transition: %o', event);
		var dfr = null;
		var attr = 'transition';
		var v = this.get_viewer();
		var fx_temp = null;
		var anim_on = v.animation_enabled();
		if ( v.get_attribute(attr, true) && this.util.is_string(event) ) {
			var anim_stop = function() {
				var l = v.get_layout();
				l.find('*').each(function() {
					var el = $(this);
					while ( el.queue().length ) {
						el.stop(false, true);
					}
				});
			}
			//Stop queued animations
			if ( !!clear_queue ) {
				anim_stop();
			}
			//Get transition handlers
			var attr_set = [attr, 'set'].join('_');
			var trns;
			if ( !this.get_attribute(attr_set) ) {
				var models = this.get_ancestors(true);
				trns = [];
				this.set_attribute(attr_set, true);
				var thm = this;
				$.each(models, function(idx, model) {
					if ( attr in model && thm.util.is_obj(model[attr]) ) {
						trns.push(model[attr]);
					}
				});
				//Merge transition handlers into current theme
				trns.push({});
				trns = this.set_attribute(attr, $.extend.apply($, trns.reverse()));
			} else {
				trns = this.get_attribute(attr, {});
			}
			if ( this.util.is_method(trns, event) ) {
				//Disable animations if necessary
				if ( !anim_on ) {
					fx_temp = $.fx.off;
					$.fx.off = true;
				}
				//Pass control to transition event
				dfr = trns[event].call(this, v, $.Deferred());
			}
		}
		if ( !this.util.is_promise(dfr) ) {
			dfr = $.Deferred();
			dfr.reject();
		}
		dfr.always(function() {
			//Restore animation state
			if ( null !== fx_temp ) {
				$.fx.off = fx_temp;
			}
		});
		console.groupEnd();
		return dfr.promise();
	}
};

View.Theme = Modeled_Component.extend(Theme);

/**
 * Template handler
 * Parses and Builds layout from raw template
 */
var Template = {
	/* Configuration */
	
	_slug: 'template',
	_reciprocal: true,
	
	_refs: {
		'theme': 'Theme'
	},
	_containers: ['theme'],
	
	_attr_default: {
		/**
		 * URI to layout (raw) file
		 * @var string
		 */
		layout_uri: '',
		
		/**
		 * Raw layout template
		 * @var string
		 */	
		layout_raw: '',
		/**
		 * Parsed layout
		 * Placeholders processed
		 * @var string
		 */
		layout_parsed: '',
		/**
		 * Tags in template
		 * Populated once template has been parsed
		 * @var array
		 */
		tags: null,
		/**
		 * Model to use for properties
		 * Usually reference to an object in other component
		 * @var obj
		 */
		model: null
	},
	
	/* References */
	
	theme: null,
	
	/* Methods */
	
	_c: function(attributes) {
		console.groupCollapsed('Template.Constructor');
		this._super('', attributes);
		console.groupEnd();
	},
	
	get_theme: function() {
		console.groupCollapsed('Template.get_theme');
		var ret = this.get_component('theme', true, false, false);
		console.groupEnd();
		return ret;
	},
	
	/* Output */
	
	/**
	 * Render output
	 * @param bool init (optional) Whether to initialize layout (TRUE) or render item (FALSE) (Default: FALSE)
	 * Events
	 *  > render-init: Initialize template
	 *  > render-loading: DOM elements created and item content about to be loaded
	 *  > render-complete: Item content loaded, ready for display
	 */
	render: function(init) {
		console.group('Template.render');
		var v = this.get_theme().get_viewer();
		if ( !this.util.is_bool(init) ) {
			init = false;
		}
		//Populate layout
		if ( !init ) {
			if ( !v.is_active() ) {
				console.groupEnd();
				return false;
			}
			var item = v.get_item();
			console.log('Item is valid: %o', this.util.is_type(item, View.Content_Item));
			if ( !this.util.is_type(item, View.Content_Item) ) {
				v.close();
				console.groupEnd();
				return false;
			}
			console.info('Rendering Item');
			//Iterate through tags and populate layout
			if ( v.is_active() && this.has_tags() ) {
				var loading_promise = this.trigger('render-loading');
				console.info('Loading is promise: %o \nResolved: %o', this.util.is_promise(loading_promise), loading_promise.state());
				var tpl = this;
				var tags = this.get_tags(),
					tag_promises = [];
				console.info('Tags in template: %o', tags);
				//Render Tag output
				loading_promise.done(function() {
					if ( !v.is_active() ) {
						return false;
					}
					console.groupCollapsed('Processing Tags');
					$.each(tags, function(idx, tag) {
						if ( !v.is_active() ) {
							return false;
						}
						console.log('Tag DOM: %o', tag.dom_get().get(0));
						console.groupCollapsed('Processing Tag: %o', [tag.get_name(), tag.get_prop()].join('.'));
						tag_promises.push(tag.render(item).done(function(r) {
							if ( !v.is_active() ) {
								return false;
							}
							console.log('Tag rendered: %o', [r.tag.get_name(), r.tag.get_prop()].join('.'));
							console.group('Tag Processing Callback');
							console.info('Tag Output: %o', r.output);
							r.tag.dom_get().html(r.output);
							console.groupEnd();
						}));
						console.groupEnd();
					});
					console.groupEnd();
					//Fire event when all tags rendered
					if ( !v.is_active() ) {
						return false;
					}
					$.when.apply($, tag_promises).done(function() {
						tpl.trigger('render-complete');
					});
				});
			}
		} else {
			console.info('Building basic layout');
			//Get Layout (basic)
			this.trigger('render-init', this.dom_get());
		}
		console.groupEnd();
	},
	
	/*-** Layout **-*/
	
	/**
	 * Retrieve layout
	 * @param bool parsed (optional) TRUE retrieves parsed layout, FALSE retrieves raw layout (Default: TRUE)
	 * @return string Layout (HTML)
	 */
	get_layout: function(parsed) {
		console.groupCollapsed('Template.get_layout: %o', parsed);
		//Validate
		if ( !this.util.is_bool(parsed) ) {
			parsed = true;
		}
		//Determine which layout to retrieve (raw/parsed)
		var l = ( parsed ) ? this.parse_layout() : this.get_attribute('layout_raw', '');
		console.log('Layout: %o', l);
		console.groupEnd();
		return l;
	},
	
	/**
	 * Parse layout
	 * Converts template tags to HTML elements
	 * > Template tag properties saved to HTML elements for future initialization
	 * Returns saved layout if previously parsed
	 * @return string Parsed layout
	 */
	parse_layout: function() {
		//Check for previously-parsed layout
		var a = 'layout_parsed';
		var ret = this.get_attribute(a);
		//Return cached layout immediately
		if ( this.util.is_string(ret) ) {
			return ret;
		}
		//Parse raw layout
		ret = this.sanitize_layout( this.get_layout(false) );
		ret = this.parse_tags(ret);
		//Save parsed layout
		this.set_attribute(a, ret);
		
		//Return parsed layout
		return ret;
	},
	
	/**
	 * Sanitize layout
	 * @param obj|string l Layout string or jQuery object
	 * @return obj|string Sanitized layout (Same data type that was passed to method)
	 */
	sanitize_layout: function(l) {
		console.groupCollapsed('Template.sanitize_layout');
		console.log('Pre sanitize: %o', l);
		//Stop processing if invalid value
		if ( this.util.is_empty(l) ) {
			console.warn('Layout is empty, nothing to sanitize');
			console.groupEnd();
			return l;
		}
		//Set return type
		var rtype = ( this.util.is_string(l) ) ? 'string' : null;
		/* Quarantine hard-coded tags */
			
		//Create DOM structure from raw template
		var dom = $(l);
		//Find hard-coded tag nodes
		var tag_temp = new View.Template_Tag();
		var cls = tag_temp.get_class();
		var cls_new = ['x', cls].join('_');
		$(tag_temp.get_selector(), dom).each(function(idx) {
			//Replace matching class name with blocking class
			$(this).removeClass(cls).addClass(cls_new);
		});
		//Format return value
		switch ( rtype ) {
			case 'string' :
				dom = dom.wrap('<div />').parent().html();
				console.info('Converting DOM tree to string: %o', dom);
			default :
				l = dom;
		}
		console.groupEnd();
		return l;
	},
	
	/*-** Tags **-*/
	
	/**
	 * Extract tags from template
	 * Tags are replaced with DOM element placeholders
	 * Extracted tags are saved as element attribute values (for future use)
	 * @param string l Raw layout to parse
	 * @return string Parsed layout
	 */
	parse_tags: function(l) {
		console.group('Template.parse_tags');
		//Validate
		if ( !this.util.is_string(l) ) {
			return '';
		}
		//Parse tags in layout
		console.groupCollapsed('Find tags');
		//Tag regex
		var re = /\{{2}\s*(\w.*?)\s*\}{2}/gim;
		//Tag match results
		var match;
		//Iterate through template and find tags
		while ( match = re.exec(l) ) {
			//Replace tag in layout with DOM container
			l = l.substring(0, match.index) + this.get_tag_container(match[1]) + l.substring(match.index + match[0].length);
		}
		console.groupEnd();
		console.log('Parsed Layout: %o', l);
		console.groupEnd();
		return l;
	},
	
	/**
	 * Create DOM element container for tag
	 * @param string Tag ID (will be prefixed)
	 * @return string DOM element
	 */
	get_tag_container: function(tag) {
		//Build element
		console.log('Tag: %o', tag);
		var attr = this.get_tag_attribute();
		console.log('Attribute: %o', attr);
		return '<span %s="%s"></span>'.sprintf(attr, escape(tag)); 
	},
	
	get_tag_attribute: function() {
		return this.get_parent().get_component_temp(View.Template_Tag).dom_get_attribute();
	},
	
	/**
	 * Retrieve Template_Tag instance at specified index
	 * @param int idx (optional) Index to retrieve tag from
	 * @return Template_Tag Tag instance
	 */
	get_tag: function(idx) {
		var ret = null;
		if ( this.has_tags() ) {
			var tags = this.get_tags();
			if ( !this.util.is_int(idx) || 0 > idx || idx >= tags.length ) {
				idx = 0;
			}
			ret = tags[idx];
		}
		return ret;
	},
	
	/**
	 * Retrieve tags from template
	 * Subset of tags may be retrieved based on parameter values
	 * Template is parsed if tags not set
	 * @param string name (optional) Tag type to retrieve instances of
	 * @param string prop (optional) Tag property to retrieve instances of
	 * @return array Template_Tag instances
	 */
	get_tags: function(name, prop) {
		console.groupCollapsed('Template.get_tags');
		var a = 'tags';
		var tags = this.get_attribute(a);
		//Initialize tags
		if ( !this.util.is_array(tags) ) {
			tags = [];
			console.groupCollapsed('Retrieving tags');
			//Retrieve layout DOM tree
			var d = this.dom_get();
			//Select tag nodes
			var attr = this.get_tag_attribute();
			var nodes = $(d).find('[' + attr + ']');
			console.log('Nodes: %o', nodes);
			//Build tag instances from nodes
			$(nodes).each(function(idx) {
				//Get tag placeholder
				var el = $(this);
				var tag = new View.Template_Tag(unescape(el.attr(attr)));
				console.log('Node: %o \nTag: %o', el, tag);
				//Populate valid tags
				if ( tag.has_handler() ) {
					console.info('Tag has handler');
					//Add tag to array
					tags.push(tag);
					//Connect tag to DOM node
					tag.dom_set(el);
					//Set classes
					el.addClass(tag.get_classes(' '));
				}
				//Clear data attribute
				el.removeAttr(attr);
			});
			//Save tags
			this.set_attribute(a, tags, false);
			console.log('Saved tags: %o', tags);
			console.groupEnd();
		}
		tags = this.get_attribute(a, [], false);
		//Filter tags by parameters
		if ( !this.util.is_empty(tags) && this.util.is_string(name) ) {
			//Normalize
			if ( !this.util.is_string(prop) ) {
				prop = false;
			}
			var tags_filtered = [];
			var tc = null;
			for ( var x = 0; x < tags.length; x++ ) {
				tc = tags[x];
				if ( name == tc.get_name() ) {
					//Check tag property
					if ( !prop || prop == tc.get_prop() ) {
						tags_filtered.push(tc);
					}
				}
			}
			tags = tags_filtered;
		}
		console.log('Return value: %o', tags);
		console.groupEnd();
		return ( this.util.is_array(tags, false) ) ? tags : [];
	},
	
	/**
	 * Check if template contains tags
	 * @return bool TRUE if tags exist, FALSE otherwise
	 */
	has_tags: function() {
		return ( this.get_tags().length > 0 ) ? true : false;
	},
	
	/*-** DOM **-*/
	
	/**
	 * Custom DOM initialization 
	 */
	dom_init: function() {
		console.group('Template.dom_init');
		console.info('Layout needs to be parsed');
		//Create DOM object from parsed layout
		this.dom_set(this.get_layout());
		console.groupEnd();
	},
	
	/**
	 * Retrieve DOM element(s) for specified tag
	 * @param string tag Name of tag to retrieve
	 * @param string prop (optional) Specific tag property to retrieve
	 * @return array DOM elements for tag
	 */
	dom_get_tag: function(tag, prop) {
		console.groupCollapsed('Template.dom_get_tag()');
		var ret = $();
		var tags = this.get_tags(tag, prop);
		if ( tags.length ) {
			//Build selector
			var level = null;
			if ( this.util.is_string(tag) ) {
				level = ( this.util.is_string(prop) ) ? 'full' : 'tag';
			}
			var sel = '.' + tags[0].get_class(level);
			console.log('Selector')
			ret = this.dom_get().find(sel);
		}
		console.log('Tag elements: %o', ret);
		console.groupEnd();
		return ret;
	}
};

View.Template = Modeled_Component.extend(Template);

/**
 * Template tag 
 */
var Template_Tag = {
	/* Configuration */
	_slug: 'template_tag',
	_reciprocal: true,
	/* Properties */
	_attr_default: {
		name: null,
		prop: null,
		match: null
	},
	/**
	 * Tag Handlers
	 * Collection of Template_Tag_Handler instances
	 * @var obj 
	 */
	handlers: {},
	/* Methods */
	
	/**
	 * Constructor
	 * @param 
	 */
	_c: function(tag_match) {
		console.groupCollapsed('Template_Tag.Constructor');
		console.info('Parse tag instance');
		this.parse(tag_match);		
		console.groupEnd();
	},
	
	/**
	 * Set instance attributes using tag extracted from template
	 * @param string tag_match Extracted tag match
	 */
	parse: function(tag_match) {
		console.groupCollapsed('Template_Tag.parse');
		//Return default value for invalid instances
		if ( !this.util.is_string(tag_match) ) {
			console.groupEnd();
			return false;
		}
		//Parse instance options
		var parts = tag_match.split('|'),
			part;
		if ( !parts.length ) {
			console.groupEnd();
			return null;
		}
		var attrs = {
			name: null,
			prop: null,
			match: tag_match
		};
		//Get tag ID
		attrs.name = parts[0];
		//Get main property
		if ( attrs.name.indexOf('.') != -1 ) {
			attrs.name = attrs.name.split('.', 2);
			attrs.prop = attrs.name[1];
			attrs.name = attrs.name[0];
		}
		//Get other attributes
		for ( var x = 1; x < parts.length; x++ ) {
			part = parts[x].split(':', 1);
			if ( part.length > 1 &&  !( part[0] in attrs ) ) {
				//Add key/value pair to attributes
				attrs[part[0]] = part[1];
			}
		}
		//Save to instance
		this.set_attributes(attrs, true);
		console.groupEnd();
	},
	
	/**
	 * Render tag output
	 * @param Content_Item item
	 * @return obj jQuery.Promise object that is resolved when tag is rendered
	 * Parameters passed to callbacks
	 * > tag 	obj		Current tag instance
	 * > output	string	Tag output
	 */
	render: function(item) {
		var tag = this;
		return tag.get_handler().render(item, tag).pipe(function(output) {
			return {'tag': tag, 'output': output};
		});
	},
	
	/**
	 * Retrieve tag name
	 * @return string Tag name (DEFAULT: NULL)
	 */
	get_name: function() {
		return this.get_attribute('name');
	},
	
	/**
	 * Retrieve tag property
	 */
	get_prop: function() {
		return this.get_attribute('prop');
	},
	
	/**
	 * Retrieve tag handler
	 * @return Template_Tag_Handler Handler instance (Empty instance if handler does not exist)
	 */
	get_handler: function() {
		return ( this.has_handler() ) ? this.handlers[this.get_name()] : new View.Template_Tag_Handler('');
	},
	
	/**
	 * Check if handler exists for tag
	 * @return bool TRUE if handler exists, FALSE otherwise
	 */
	has_handler: function() {
		return ( this.get_name() in this.handlers );
	},
	
	/**
	 * Generate class names for DOM node
	 * @param string rtype (optional) Return data type
	 *  > Default: array
	 *  > If string supplied: Joined classes delimited by parameter
	 * @uses get_class() to generate class names
	 * @uses Array.join() to convert class names array to string
	 * @return array Class names
	 */
	get_classes: function(rtype) {
		//Build array of class names
		var cls = [
			//General tag class
			this.get_class(),
			//Tag name
			this.get_class('tag'),
			//Tag name + property
			this.get_class('full')
		];
		//Convert class names array to string
		if ( this.util.is_string(rtype) ) {
			cls = cls.join(rtype);
		}
		//Return class names
		return cls;
	},
	
	/**
	 * Generate DOM-compatible class name based with varied levels of specificity
	 * @param int level (optional) Class name specificity
	 *  > Default: General tag class (common to all tag elements)
	 *  > tag: Tag Name
	 *  > full: Tag Name + Property
	 * @return string Class name
	 */
	get_class: function(level) {
		var cls = '';
		switch ( level ) {
			case 'tag' :
				//Tag name
				cls = this.add_ns(this.get_name());
				break;
			case 'full' :
				//Tag name + property
				cls = this.add_ns([this.get_name(), this.get_prop()].join('_'));
				break;
			default :
				//General
				cls = this.get_ns(); 
				break;
		}
		return cls;
	},
	
	/**
	 * Generate tag selector based on specified class name level
	 * @param string level (optional) Class name specificity (@see get_class() for parameter values)
	 * @return string Tag selector
	 */
	get_selector: function(level) {
		return '.' + this.get_class(level);
	}
};

View.Template_Tag = Component.extend(Template_Tag);

/**
 * Theme tag handler
 */
var Template_Tag_Handler = {
	/* Configuration */
	_slug: 'template_tag_handler',
	/* Properties */
	_attr_default: {
		supports_modifiers: false,
		dynamic: false,
		props: {}
	},
	
	/* Methods */
	
	/**
	 * Render tag output
	 * @param Content_Item item Item currently being displayed
	 * @param Template_Tag Tag instance (from template)
	 * @return obj jQuery.Promise linked to rendering process
	 */
	render: function(item, instance) {
		console.group('Template_Tag_Handler.render');
		var dfr = $.Deferred();
		//Pass to attribute method
		var ret = this.call_attribute('render', item, instance);
		//Check for promise
		if ( this.util.is_promise(ret) ) {
			ret.done(function(output) {
				dfr.resolve(output);
			});
		} else {
			//Resolve non-promises immediately
			dfr.resolve(ret);
		}
		//Return promise
		console.groupEnd();
		return dfr.promise();
	},
	
	add_prop: function(prop, fn) {
		//Get attribute
		var a = 'props';
		var props = this.get_attribute(a);
		//Validate
		if ( !this.util.is_string(prop) || !this.util.is_func(fn) ) {
			return false;
		}
		if ( !this.util.is_obj(props, false) ) {
			props = {};
		}
		//Add property
		props[prop] = fn;
		//Save attribute
		this.set_attribute(a, props);
	},
	
	handle_prop: function(prop, item, instance) {
		//Locate property
		var props = this.get_attribute('props');
		var out = '';
		if ( this.util.is_obj(props) && ( prop in props ) && this.util.is_func(props[prop]) ) {
			out = props[prop].call(this, item, instance);
		} else {
			out = item.get_viewer().get_label(prop);
		}
		return out;
	}
};

View.Template_Tag_Handler = Component.extend(Template_Tag_Handler);
console.groupCollapsed('Pre Init');
/* Update References */

//Attach to global object
SLB.attach('View', View);
View = SLB.View;
console.info('Updating references');
View.update_refs();

console.groupEnd();
})(jQuery);