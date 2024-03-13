var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");

const passport = require("passport");
const puppeteer = require("puppeteer");
const LocalStrategy = require("passport-local").Strategy;
const asyncHandler = require("express-async-handler");
const {
  body,
  validationResult,
  customSanitizer,
} = require("express-validator");
const passportJWT = require("passport-jwt");
const jwt = require("jsonwebtoken");
const JWTStrategy = require("passport-jwt").Strategy;
const ExtractJWT = require("passport-jwt").ExtractJwt;
const bcrypt = require("bcryptjs");
const jwt_decode = require("jwt-decode");
const { DateTime } = require("luxon");
const mongoose = require("mongoose");
mongoose.set("strictQuery", false);
require("dotenv").config();
const dev_db_url = process.env.MONGOURL;
const mongoDB = dev_db_url;
const helmet = require("helmet");
const RateLimit = require("express-rate-limit");
const multer = require("multer");
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });
const cors = require("cors");
const fetch = (...args) =>
  import("node-fetch").then(({ default: fetch }) => fetch(...args));

const User = require("./models/user");
const Meal = require("./models/meal");
const Plan = require("./models/plan");
const Ingredient = require("./models/ingredient");

mongoose.connect(mongoDB, { useUnifiedTopology: true, useNewUrlParser: true });
const db = mongoose.connection;
db.on("error", console.error.bind(console, "mongo connection error"));

var app = express();

// view engine setup
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "jade");

app.use(
  helmet.contentSecurityPolicy({
    directives: {
      "script-src": ["'self'", "code.jquery.com", "cdn.jsdelivr.net"],
      "img-src": ["'self'", "https: data:"],
    },
  }),
);

const corsOptions = {
  origin: "*",
  credentials: true,
  optionSuccessStatus: 200,
};

app.use(cors(corsOptions));
app.use(passport.initialize());
app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

(async () => {
  const browser = await puppeteer.launch({
    headless: false,
  });
  const page = await browser.newPage();
  await page.goto("https://example.com");
})();

passport.use(
  new LocalStrategy(async (username, password, done) => {
    try {
      const user = await User.findOne({ username: username }).exec();
      if (!user) {
        return done(null, false, { message: "Incorrect username" });
      } else {
        bcrypt.compare(password, user.password, (err, res) => {
          if (res === true) {
            return done(null, user);
          } else {
            return done(null, false, { message: "Incorrect password" });
          }
        });
      }
    } catch (err) {
      return done(err);
    }
  }),
);

passport.use(
  new JWTStrategy(
    {
      jwtFromRequest: ExtractJWT.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.SECRET,
    },
    async (jwt_payload, done) => {
      console.log(jwt_payload);
      const user = await User.findById(jwt_payload.user._id).exec();
      if (user) {
        return done(null, user);
      } else {
        return done(null, false);
      }
    },
  ),
);

app.post("/signup", upload.any(), [
  body("username", "Username must not be empty")
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body("password", "Password must not be empty")
    .trim()
    .isLength({ min: 1 })
    .escape(),
  body("passwordConfirmation")
    .custom((value, { req }) => {
      return value === req.body.password;
    })
    .withMessage("Passwords must match"),
  asyncHandler(async (req, res, next) => {
    const result = validationResult(req);

    if (!result.isEmpty()) {
      return res.json({
        errors: result.array(),
      });
    } else {
      let salt = bcrypt.genSaltSync(10);
      let hash = bcrypt.hashSync(req.body.password, salt);
      user.password = hash;
      await user.save();
      const plan = new Plan({
        user: user._id,
      });
      res.json(user);
    }
  }),
]);

app.post("/login", upload.any(), async (req, res, next) => {
  passport.authenticate(
    "local",
    { session: false },
    async (err, user, info) => {
      if (!user || err) {
        return res
          .status(404)
          .json({ message: "Incorrect username or password", status: 404 });
      } else {
        const secret = process.env.SECRET;
        const authuser = await User.findOne({
          username: req.body.username,
        }).exec();
        if (typeof window !== "undefined") {
          localStorage.setItem("jwt", JSON.stringify(token));
        }
        return res.json({ token });
      }
    },
  )(req, res, next);
});

app.get(
  "/item/:itemtype/:pageid",
  asyncHandler(async (req, res, next) => {
    const itemtype = req.params.itemtype;
    const pageno = req.params.pageid;

    puppeteer.launch().then(async function (browser) {
      const page = await browser.newPage();
      await page.goto(
        `https://www.tesco.com/groceries/en-GB/search?query=${itemtype}&page=${pageno}`,
      );
      const itemlist = await page.$$eval(
        ".product-list > .product-list--list-item > .dtCNPH > .fZWbCY > .bkNhNP > .bcglTg > .product-details--wrapper > .gbIAbl > .hXcydL > .xZAYu",
        function (itemnames) {
          return itemnames.map(function (itemname) {
            return itemname.innerText;
          });
        },
      );
      const pricelist = await page.$$eval(
        ".product-list > .product-list--list-item > .dtCNPH > .fZWbCY > .bkNhNP > .bcglTg > .product-details--wrapper > .cZskDh > .dSvjUC > .dAXuso > .lcrYKS > form > .beans-buybox__container > .beans-buybox__price-and-actions > .beans-price__container > .beans-price__text",
        function (itemprices) {
          return itemprices.map(function (itemprice) {
            return itemprice.innerText;
          });
        },
      );
      const linklist = await page.$$eval(
        ".product-list > .product-list--list-item > .dtCNPH > .fZWbCY > .bkNhNP > .bcglTg > .product-details--wrapper > .gbIAbl > .hXcydL",
        function (itemlinks) {
          return itemlinks.map(function (itemlink) {
            return itemlink.href;
          });
        },
      );

      let iteminfo = {
        names: itemlist,
        prices: pricelist,
        links: linklist,
      };

      await browser.close();

      if (itemlist.length == 0) {
        res.status(404).json({ message: "No results", status: 404 });
      } else {
        res.json(iteminfo);
      }
    });
  }),
);

app.post("/meal", upload.any(), [
  body("mealname", "Please enter a meal name")
    .trim()
    .isLength({ min: 1 })
    .escape(),
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);

    const meal = new Meal({
      name: req.body.mealname,
      user: { type: Schema.Types.ObjectId, ref: "User" },
    });
    if (!errors.isEmpty()) {
      return res.json({
        meal: meal,
        errors: errors.array(),
      });
    } else {
      await meal.save();
      res.json(meal);
    }
  }),
]);

app.get(
  "/item/:itemlink/:mealid",
  asyncHandler(async (req, res, next) => {
    const link = req.params.itemlink;
    const meal = req.params.mealid;

    puppeteer.launch().then(async function (browser) {
      const page = await browser.newPage();
      await page.goto(`${link}`);
      const acceptables = [
        "Fresh Food",
        "Bakery",
        "Frozen Food",
        "Treats & Snacks",
        "Food Cupboard",
        "Drinks",
      ];
      const subtype = await page.$eval(".eZJvMx", (el) => el.innerText);
      let included = false;
      for (const allowed of acceptables) {
        if (subtype == allowed) {
          included = true;
        }
      }
      if (included == false) {
        res
          .status(403)
          .json({ message: "Not an accepted food or drink for meal plan" });
      }
      const title = await page.$eval(".flNJKr .kdSqXr", (el) => el.innerText);
      const price = await page.$eval(".lmgzsH .eNIEDh", (el) => el.innerText);
      await page.click(".gjVUFe");
      await page.waitForSelector(
        ".product__info-table > tbody > tr:nth-child(9)",
      );
      const size = await page.$eval(
        ".product__info-table > thead > tr > th:nth-child(3)",
        (el) => el.innerText,
      );
      const second = await page.$eval(
        ".product__info-table > tbody > tr:nth-child(1) > td:nth-child(2)",
        (el) => el.innerText,
      );
      let calories;
      let shift = 0;
      if (second.includes("/")) {
        let start = second.indexOf("/");
        let finish = second.indexOf("kcal");
        calories = Number(second.slice(start + 1, finish));
      }
      if (!second.includes("/")) {
        shift += 1;
        const secondalt = await page.$eval(
          ".product__info-table > tbody > tr:nth-child(2) > td:nth-child(2)",
          (el) => el.innerText,
        );
        let finish = secondalt.indexOf("kcal");
        calories = Number(secondalt.slice(0, finish));
      }

      let fat;
      let saturated;
      let carbohydrate;
      let sugars;
      let fibre;
      let protein;
      let salt;

      let categories = [
        fat,
        saturated,
        carbohydrate,
        sugars,
        fibre,
        protein,
        salt,
      ];

      for (i = 2 + shift; i < 9 + shift; i++) {
        const unftext = await page.$eval(
          `.product__info-table > tbody > tr: nth-child(${i}) > td:nth-child(2)`,
          (el) => el.innerText,
        );
        if (unftext.includes("<")) {
          let start = 1;
          let finish = unftext.indexOf("g");
          categories[i - 2 - shift] = Number(unftext.slice(start, finish));
        } else {
          let start = 0;
          let finish = unftext.indexOf("g");
          categories[i - 2 - shift] = Number(unftext.slice(start, finish));
        }
      }

      await browser.close();

      const ingredient = new Ingredient({
        name: title,
        calories: calories,
        fat: fat,
        saturated: saturated,
        carbohydrate: carbohydrate,
        sugars: sugars,
        fibre: fibre,
        protein: protein,
        salt: salt,
        cost: price,
        quantity: 1,
        meal: meal,
        size: size,
      });
      res.json(ingredient);
    });
  }),
);

app.put("/meals/:mealid/:ingredientid", upload.any(), [
  body("quantity")
    .exists({ checkFalsy: true })
    .withMessage("You must enter an amount")
    .custom((value) => {
      const amount = Number(value);
      const amountFloat = amount.toFixed(2);
      return amountFloat > 0 && amountFloat <= 10;
    })
    .withMessage("Serving sizes limited between 0 and 10"),

  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);

    const meal = await Meal.findById(req.params.mealid).exec();
  }),
]);

module.exports = app;
