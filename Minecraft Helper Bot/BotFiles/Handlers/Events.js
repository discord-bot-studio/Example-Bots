const Discord = require("discord.js");
const MsgHandler = require("./Message");
cache = require("../BotData/varcache");
usercache = require("../BotData/usercache");
var usersFile = __dirname + "/../BotData/user/user.json";
var userCache = usercache.memoryCache.users;
const Functions = require("../DiscordFunctions");
var guild;
var breakFailure = true;
const fs = require("fs");
const Papa = require("papaparse");
const path = require("path");
vars = {};
var varsEToPass;

module.exports.Event_Handle = function (client, events, type, varsE, aEvent) {
    var applicableEvent;
    guild = varsE.guild;
    varsEToPass = varsE;
    console.log("handling event");

    if (!aEvent) {
        applicableEvent = events.command.find(e => e.name == type);
        if (varsE.user) {
            if (!cache[guild.id]) cache[guild.id] = {};
            let cVars = cache[guild.id];
            if (!cVars.variables) cVars.variables = [];
            let vararray = cVars.variables;

            if (!contains(vararray, "name", applicableEvent.var.user)) {
                vararray.push({
                    name: applicableEvent.var.user,
                    value: varsE.user.id,
                    type: "User"
                });
                cVars.variables = vararray;
                cache[guild.id] = cVars;
            } else {
                let varEntry = vararray.find(ve => ve.name == applicableEvent.var.user);
                varEntry.value = varsE.user.id;
                cVars.variables = vararray;
                cache[guild.id] = cVars;
            }
        }
    } else {
        applicableEvent = aEvent;
    }
    this.RunActions(client, applicableEvent);
};

module.exports.RunActions = function (client, applicableEvent) {
    // Write the user variable to cache if applicable
    breakFailure = true;
    for (var j = 0; j < applicableEvent.actions.length; j++) {
        console.log("looping");
        if (!breakFailure) {
            break;
        }
        let parsedAction = ParseActionVariables(applicableEvent.actions[j]);
        //console.log(parsedAction);
        switch (parsedAction.type) {
            case "Send Message":
                SendMessage(client, parsedAction);
                break;
            case "Send Image":
                SendImage(client, parsedAction);
                break;
            case "Send Embed":
                SendEmbed(client, parsedAction);
                break;
            case "Send Direct Message":
                SendDirectMessage(client, parsedAction);
                break;
            case "Add Role to User":
                AddRoletoUser(client, parsedAction);
                break;
            case "Set User Data":
                SetUserData_Handle(client, parsedAction);
                break;
            case "Get User Data":
                StoreValueinVariable_Handle(client, parsedAction);
                break;
            case "Edit User Data":
                EditUserData(client, parsedAction);
                break;
            case "Check User Data":
                this.CheckUserData(client, parsedAction);
                break;
            case "Get Row":
                GetRow_Handle(client, parsedAction);
                break;
            case "Generate Random Number":
                StoreValueinVariable_Handle(client, parsedAction);
                break;
            case "Edit Variable":
                EditVariable_Handle(client, parsedAction);
                break;
            case "Check Variable Value":
                this.CheckVariableValue_Handle(client, parsedAction);
                break;
        }
    }

    fs.writeFileSync(usersFile, JSON.stringify(usercache.memoryCache, null, 2), function (err) {
        if (err) return console.log(err);
    });
};

function SendMessage(client, action) {
    let chan = guild.channels.find(ch => ch.name === action.channelname);
    if (!chan && action.channelname != "") {
        console.log("ERROR: No channel found with name: " + action.channelname + ". Action name: " + action.name);
    } else {
        chan.send(action.messagetext);
    }
}

function SendImage(client, action) {
    const chan = guild.channels.find(ch => ch.name === action.channelname);
    if (!chan && action.channelname != "") {
        console.log("ERROR: No channel found with name: " + action.channelname + ". Action name: " + action.name);
    } else {
        chan.send({ files: [action.url] });
    }
}

function SendEmbed(client, action) {
    const Embed = new Discord.RichEmbed()
        .setColor(action.color)
        .setTitle(action.title)
        .setURL(action.url)
        .setAuthor(action.authorname, action.authorimageurl, action.authorlink)
        .setDescription(action.description)
        .setThumbnail(action.thumbnail)
        .setImage(action.image)
        .setFooter(action.footer);
    if (action.timestamp == "BOOL_TRUE@@") {
        Embed.setTimestamp();
    }

    if (action.fields) {
        action.fields.forEach(field => {
            var inlineTrue = field.inline == "true";
            if (field.name !== "" && field.value !== "") Embed.addField(field.name, field.value, inlineTrue);
        });
    }

    const chan = guild.channels.find(ch => ch.name === action.channelname);
    // Validate channel
    if (!chan && action.channelname != "") {
        console.log("ERROR: No channel found with name: " + action.channelname + ". Action name: " + action.name);
    } else {
        chan.send(Embed);
    }
}

function SendDirectMessage(client, action) {
    var member = guild.members.find(gm => gm.user.tag == action.user || gm.user.id == action.user);

    if (!member) {
        console.log("ERROR: No user found for direct message");
    } else {
        member.send(action.messagetext);
    }
}

function AddRoletoUser(client, action) {
    var member = guild.members.find(gm => gm.user.tag == action.user || gm.user.id == action.user);
    if (!member) {
        console.log("ERROR: No user found to give role");
    } else {
        var rolel = guild.roles.find(role => role.name == action.rolename);
        if (!rolel) {
            console.log("ERROR: No role found to give role");
        } else {
            member.addRole(rolel);
        }
    }
}

function SetUserData_Handle(client, action) {
    let mem = guild.members.find(gm => gm.user.tag == action.user || gm.user.id == action.user);
    if (!userCache[mem.id]) {
        userCache[mem.id] = {};
    }
    let valToSet = null;
    if (!isNaN(action.fieldvalue)) {
        valToSet = parseInt(action.fieldvalue);
    } else {
        valToSet = action.fieldvalue;
    }
    userCache[mem.id][action.field] = valToSet;
}

module.exports.CheckUserData = function (client, action) {
    let mem = guild.members.find(gm => gm.user.tag == action.user || gm.user.id == action.user);
    var trueOrFalse = null;
    var valToCheck;
    if (userCache[mem.id]) {
        if (userCache[mem.id][action.field] !== null) {
            if (action.compare === "greater than") {
                if (!isNaN(action.value)) {
                    valToCheck = parseInt(action.value);
                    let currentVal = parseInt(userCache[mem.id][action.field]);
                    if (currentVal > valToCheck) {
                        trueOrFalse = true;
                    } else {
                        trueOrFalse = false;
                    }
                }
            }
            if (action.compare === "less than") {
                if (!isNaN(action.value)) {
                    valToCheck = parseInt(action.value);
                    let currentVal = parseInt(userCache[mem.id][action.field]);
                    if (currentVal < valToCheck) {
                        trueOrFalse = true;
                    } else {
                        trueOrFalse = false;
                    }
                }
            }
            if (action.compare === "equal to") {
                valToCheck = action.value;
                let currentVal = userCache[mem.id][action.field];
                if (currentVal == valToCheck) {
                    trueOrFalse = true;
                } else {
                    trueOrFalse = false;
                }
            }
            var passActions = {};

            if (trueOrFalse === true) {
                passActions.actions = action.trueActions;
                this.Event_Handle(client, "", "", varsEToPass, passActions);
            } else {
                passActions.actions = action.falseActions;
                this.Event_Handle(client, "", "", varsEToPass, passActions);
            }
        }
    }
};

function EditUserData(client, action) {
    let mem = guild.members.find(gm => gm.user.tag == action.user || gm.user.id == action.user);

    if (!userCache[mem.id]) {
        userCache[mem.id] = {};
        userCache[mem.id][action.field] = 0;
    }

    //console.log(action);
    if (userCache[mem.id]) {
        console.log(userCache[mem.id][action.field]);
        if (userCache[mem.id][action.field] !== null) {
            let valToSet = null;
            if (!isNaN(action.value)) {
                valToSet = parseInt(action.value);
                let currentval = parseInt(userCache[mem.id][action.field]);
                if (action.oper === "+") {
                    userCache[mem.id][action.field] = currentval + valToSet;
                } else if (action.oper === "-") {
                    userCache[mem.id][action.field] -= valToSet;
                } else if (action.oper === "x") {
                    userCache[mem.id][action.field] *= valToSet;
                } else if (action.oper === "/") {
                    userCache[mem.id][action.field] /= valToSet;
                }
            }
        } else {
            console.log("field doesnt exist");
        }
    }
}

function GetUserData(client, action) {}

function ParseActionVariables(action) {
    var newaction = Object.assign({}, action);
    regex = /%%(\w+)\[([\w\s]+)\]%%/g; ///%%(.*?)%%/g;
    var regex1 = /%%(.*?)%%/g;
    // console.log(action);
    // Get the array of current variables
    Object.keys(newaction).forEach(e => {
        try {
            if (e !== "trueActions" && e !== "falseActions" && e !== "fields") {
                var newVal = newaction[e];
                newVal = newVal.replace("$$DefaultChannel$$", Functions.getDefaultChannel(guild));
                newaction[e] = newVal;
            } else if (e === "fields") {
                Array.prototype.forEach.call(newaction[e], child => {
                    var newVal = child.value;
                    newVal = newVal.replace("$$DefaultChannel$$", Functions.getDefaultChannel(guild));
                    child.value = newVal;
                });
            }
        } catch (err) {
            console.log(err);
        }
        //console.log(`key=${e}  value=${action[e]}`)
    });
    if (cache[guild.id]) {
        cache[guild.id].variables.forEach(sv => {
            if (sv.type == "Text" || sv.type == "Number" || sv.type == "User" || sv.type == "Channel" || sv.type == "row") {
                vars[sv.name] = sv.value;
            }
        });
        Object.keys(newaction).forEach(e => {
            try {
                if (e !== "trueActions" && e !== "falseActions" && e !== "fields") {
                    var newVal = newaction[e].replace(regex, (_match, group1, group2) => vars[group1][group2]);
                    console.log(newVal);

                    newVal = newVal.replace(regex1, (_match, group1) => vars[group1]);
                    newaction[e] = newVal;
                } else if (e === "fields") {
                    /*newaction[e].foreach(fieldString => {
                    consolg.log(fieldString);
                });*/
                    Array.prototype.forEach.call(newaction[e], child => {
                        var newValF = child.value.replace(regex, (_match, group1, group2) => vars[group1][group2]);
                        newValF = newValF.replace(regex, (_match, group1) => vars[group1]);
                        child.value = newValF;
                    });
                }
            } catch (err) {
                console.log(err);
            }
            //console.log(`key=${e}  value=${action[e]}`)
        });
    }
    //console.log(newaction);
    return newaction;
}

function StoreValueinVariable_Handle(client, action) {
    if (!cache[guild.id]) cache[guild.id] = {};
    let vars = cache[guild.id];
    if (!vars.variables) vars.variables = [];
    let vararray = vars.variables;
    var paramValue;
    console.log("storing var");
    if (contains(vararray, "name", action.varname)) {
        // Update the value
        console.log("ALREADY EXISTS");
        var existingvar = vararray.find(vari => vari.name == action.varname);
        if (action.type === "Get User Data") {
            let mem = guild.members.find(gm => gm.user.tag == action.user || gm.user.id == action.user);
            if (userCache[mem.id]) {
                paramValue = userCache[mem.id][action.field];
            }
        } else if (action.type === "Generate Random Number") {
            if (!isNaN(Number(action.min)) && !isNaN(Number(action.max))) {
                paramValue = Math.floor(Math.random() * (Number(action.max) - Number(action.min) + 1) + Number(action.min)).toString();
                action.vartype = "Number";
            } else {
                breakFailure = false;
            }
        }
        // If numeric then convert
        if (action.vartype == "number") {
            try {
                paramValue = Number(paramValue);
            } catch (err) {
                console.log("ERROR converting value: " + paramValue + " to number");
            }
        }

        existingvar.value = paramValue;
        existingvar.vartype = action.vartype;
        console.log("Existing var: " + existingvar.value);
    } else {
        // Write new value
        // Take whole string after the command
        if (action.type === "Get User Data") {
            let mem = guild.members.find(gm => gm.user.tag == action.user || gm.user.id == action.user);
            if (userCache[mem.id]) {
                paramValue = userCache[mem.id][action.field];
            }
        } else if (action.type === "Generate Random Number") {
            if (!isNaN(Number(action.min)) && !isNaN(Number(action.max))) {
                paramValue = Math.floor(Math.random() * (Number(action.max) - Number(action.min) + 1) + Number(action.min)).toString();
                action.vartype = "Number";
            } else {
                breakFailure = false;
            }
        }

        // If numeric then convert
        if (action.vartype == "number") {
            try {
                paramValue = Number(paramValue);
            } catch (err) {
                console.log("ERROR converting value: " + paramValue + " to number");
            }
        }
        vararray.push({
            name: action.varname,
            value: paramValue,
            type: action.vartype
        });
    }
    vars.variables = vararray;
    cache[guild.id] = vars;
    console.log(cache[guild.id]);
}

function contains(arr, key, val) {
    for (var i = 0; i < arr.length; i++) {
        if (arr[i][key] === val) return true;
    }
    return false;
}

function GetRow_Handle(client, action) {
    console.log("getting row");
    var objectToAdd = {};
    const csvFile = fs.readFileSync(path.resolve(__dirname, "../BotData/sheets/" + action.selectedsheet));
    const csvData = csvFile.toString();
    Papa.parse(csvData, {
        header: true,
        complete: function (results, file) {
            //console.log(results.data);
            var foundValue = results.data.filter(obj => obj[action.colheader] === action.colval);
            console.log(foundValue);
            if (foundValue.length > 0) {
                objectToAdd[action.rowvariable] = foundValue[0];
                console.log("option to add");
                console.log(objectToAdd);
                if (!cache[guild.id]) cache[guild.id] = {};
                let vars = cache[guild.id];
                if (!vars.variables) vars.variables = [];
                let vararray = vars.variables;
                if (contains(vararray, "name", action.rowvariable)) {
                    var existingvar = vararray.find(vari => vari.name == action.rowvariable);
                    existingvar.value = foundValue[0];
                    existingvar.type = "row";
                } else {
                    console.log(objectToAdd[action.rowvariable]);
                    vararray.push({
                        name: action.rowvariable,
                        value: foundValue[0],
                        type: "row"
                    });
                    console.log(vararray);
                }
                vars.variables = vararray;
                cache[guild.id] = vars;
                console.log(cache[guild.id]);
            } else {
                breakFailure = false;
            }
        }
    });
}

function EditVariable_Handle(client, action) {
    console.log(cache[guild.id]);
    if (!isNaN(Number(action.value))) {
        if (cache[guild.id]) {
            let vars = cache[guild.id];
            if (vars.variables) {
                let vararray = vars.variables;
                if (contains(vararray, "name", action.varname)) {
                    var existingvar = vararray.find(vari => vari.name == action.varname);
                    if (!isNaN(Number(existingvar.value))) {
                        var returnValue = 0;
                        var existingValue = Number(existingvar.value);
                        var numberToEdit = Number(action.value);
                        if (action.oper == "+") {
                            returnValue = existingValue + numberToEdit;
                        } else if (action.oper == "-") {
                            returnValue = existingValue - numberToEdit;
                        } else if (action.oper == "x") {
                            returnValue = existingValue * numberToEdit;
                        } else {
                            returnValue = existingValue / numberToEdit;
                        }
                        existingvar.value = returnValue;
                        vars.variables = vararray;
                        cache[guild.id] = vars;
                    }
                }
            }
        }
    }
}

module.exports.CheckVariableValue_Handle = function (client, action) {
    console.log("checking from event file");
    var trueOrFalse = null;
    if (cache[guild.id]) {
        console.log("cache exists");
        let vars = cache[guild.id];
        if (vars.variables) {
            let vararray = vars.variables;
            if (contains(vararray, "name", action.varname)) {
                var existingvar = vararray.find(vari => vari.name == action.varname);
                if (action.compare === "greater than") {
                    if (!isNaN(action.value)) {
                        valToCheck = parseInt(action.value);
                        let currentVal = existingvar.value;
                        if (currentVal > valToCheck) {
                            trueOrFalse = true;
                        } else {
                            trueOrFalse = false;
                        }
                    }
                }
                if (action.compare === "less than") {
                    if (!isNaN(action.value)) {
                        valToCheck = parseInt(action.value);
                        let currentVal = existingvar.value;
                        if (currentVal < valToCheck) {
                            trueOrFalse = true;
                        } else {
                            trueOrFalse = false;
                        }
                    }
                }
                if (action.compare === "equal to") {
                    valToCheck = action.value;
                    let currentVal = existingvar.value;
                    if (currentVal == valToCheck) {
                        trueOrFalse = true;
                    } else {
                        trueOrFalse = false;
                    }
                }

                console.log("true or false: " + trueOrFalse);

                var passActions = {};

                if (trueOrFalse === true) {
                    passActions.actions = action.trueActions;
                    this.RunActions(client, passActions);
                } else {
                    passActions.actions = action.falseActions;
                    this.RunActions(client, passActions);
                }
            }
        }
    }
};
