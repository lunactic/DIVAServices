import * as mongoose from "mongoose";
import * as passportLocal from "passport-local";

let Schema = mongoose.Schema;
var passportLocalMongoose = require("passport-local-mongoose");

var account = new Schema({
    username: String,
    type: String,
    password: String
}, { timestamps: true });

account.plugin(passportLocalMongoose);

let Account = mongoose.model("accounts", account) as any;

export { Account };