
var mongoose = require('mongoose'),
    path = require('path');
	
//create image schema
imageSchema = mongoose.Schema({
	path:{
		type: String,
		required: true,
		trim: true
	},
	originalname: {
		type: String,
		required: true	
	},
	filename: {type: String},
	title: {type: String},
	description: {type: String},
	gallery: {type: String},
	timestamp: {type: Date, 'default': Date.now},
	extension: {type: String},
});

imageSchema.virtual('uniqueId')
    .get(function() {
		return this.filename.replace(path.extname(this.filename), '');
    });	
	
let Image = module.exports = mongoose.model('Image', imageSchema);
