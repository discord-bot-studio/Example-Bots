/* External Modules */
const Discord = require("discord.js");
const fs = require("fs");
const path = require("path");
const AntiSpam = require("discord-anti-spam");
const winston = require("winston");

const logger = winston.createLogger({
    level: "info",
    format: winston.format.json(),
    defaultMeta: { service: "user-service" },
    transports: [
        // - Write all logs with level `error` and below to `botErrors.log`
        // - Write all logs with level `info` and below to `combined.log`
        new winston.transports.File({ filename: path.join(__dirname, "/botErrors.log"), level: "error" }),
        new winston.transports.File({ filename: "combined.log" }),
    ],
});

const DBS = {};
DBS.Bot = new Discord.Client();

DBS.MsgHandler = require("./Handlers/Message");
DBS.EventHandler = require("./Handlers/Events");
DBS.usercache = require("./BotData/usercache");

DBS.SettingsFile = require("./BotData/Settings/Settings.json");
DBS.RulesFile = require("./BotData/Settings/Rules.json");
DBS.EventsFile = require("./BotData/commands/events");
DBS.CommandsFile = require("./BotData/commands/commands");
DBS.UserFile = __dirname + "/BotData/user/user.json";
DBS.antiSpam = new AntiSpam(DBS.RulesFile.obj);

DBS.Mods = new Map();

DBS.loadMods = async function () {
    require("fs")
        .readdirSync(require("path").join(__dirname, "mods"))
        .forEach((mod) => {
            const fetchedMod = require(require("path").join(__dirname, `mods/${mod}`));
            fetchedMod.init(DBS);
            if (fetchedMod.isEvent) {
                DBS.Bot.on(fetchedMod.name, fetchedMod.mod.bind(null, DBS.Bot));
            } else if (fetchedMod.isResponse) {
                DBS.Mods.set(fetchedMod.name, fetchedMod);
            }
        });
};

DBS.checkMessage = async function (message) {
    const prefix = DBS.SettingsFile.prefix;
    if (message.author.bot) return;

    try {
        DBS.EventHandler.Event_Handle(DBS.Bot, DBS.EventsFile, "Any Message", message.member);
        DBS.antiSpam.message(message);

        if (!message.content.startsWith(prefix)) return;
        const args = message.content.slice(prefix.length).trim().split(/ +/g);
        const command = args.shift();
        for (const commandF of DBS.CommandsFile.command) {
            if (commandF.name == command) {
                for (const action of commandF.actions) {
                    const fetchedAction = DBS.Mods.get(action.type);
                    if (!fetchedAction) {
                        var msg = message;
                        msg.content = message.content.slice(prefix.length);
                        DBS.MsgHandler.Message_Handle(DBS.Bot, msg, DBS.CommandsFile);
                    } else {
                        fetchedAction.mod(DBS, message, action, args);
                    }
                }
            }

            fs.writeFileSync(DBS.UserFile, JSON.stringify(DBS.usercache.memoryCache, null, 2), function (err) {
                if (err) return console.log(err);
            });
        }
    } catch (error) {
        logger.log({
            level: "error",
            message: "Check Message: " + "[" + message.content + "] " + error.stack,
        });
    }
};

DBS.startBot = async function () {
    await DBS.Bot.login(DBS.SettingsFile.token).catch((e) => {
        logger.log({
            level: "error",
            message: "Bot login: " + e,
        });
    });
    console.log("Bot logged in");
    DBS.Bot.guilds.forEach((guild) => {
        var serverObj = {};
        serverObj.guild = guild;
        DBS.EventHandler.Event_Handle(DBS.Bot, DBS.EventsFile, "Bot Initialization", serverObj);
    });
};

DBS.loadBot = async function () {
    await DBS.loadMods().catch((e) => {
        logger.log({
            level: "error",
            message: "Loading mods: " + e,
        });
    });
    await DBS.startBot();
};

DBS.Bot.on("message", (message) => DBS.checkMessage(message));
DBS.Bot.on("guildMemberAdd", (member) => {
    try {
        DBS.EventHandler.Event_Handle(DBS.Bot, DBS.EventsFile, "User Joins Server", member);
    } catch (error) {
        logger.log({
            level: "error",
            message: "Guild member add: " + error.stack,
        });
    }
});
DBS.Bot.on("guildMemberRemove", (member) => {
    try {
        DBS.EventHandler.Event_Handle(DBS.Bot, DBS.EventsFile, "User Kicked", member);
    } catch (error) {
        logger.log({
            level: "error",
            message: "Guild member remove: " + error.stack,
        });
    }
});
DBS.Bot.on("guildBanAdd", (guild, user) => {
    let banVars = {};
    banVars.guild = guild;
    banVars.user = user;
    try {
        DBS.EventHandler.Event_Handle(DBS.Bot, DBS.EventsFile, "User Banned", banVars);
    } catch (error) {
        logger.log({
            level: "error",
            message: "Guild ban add: " + error.stack,
        });
    }
});

DBS.loadBot();

/* If the UI program is closed, kill the bot so the process isn't left hanging */
function cleanExit() {
    console.log("Killing bot");
    DBS.Bot.destroy();
    process.exit(0);
}

//process.on("SIGINT", cleanExit()); // catch ctrl-c
//process.on("SIGTERM", cleanExit());

process.on("message", (msg) => {
    if (msg.action === "STOP") {
        // Execute Graceful Termination code
        cleanExit();
    }
});
