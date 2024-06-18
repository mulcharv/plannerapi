var createError = require("http-errors");
var express = require("express");
var path = require("path");
var cookieParser = require("cookie-parser");
var logger = require("morgan");

const passport = require("passport");
const puppeteer = require("puppeteer");
const LocalStrategy = require("passport-local").Strategy;
const asyncHandler = require("express-async-handler");
const ua =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36";
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
  body("goal", "Calorie goal must not be empty")
    .custom((value) => {
      const amount = Number(value);
      const amountFloat = Number(amount.toFixed(0));
      return amountFloat > 0;
    })
    .withMessage("Amount must be greater than 0"),
  asyncHandler(async (req, res, next) => {
    const result = validationResult(req);

    const user = new User({
      username: req.body.username,
      password: req.body.password,
      goal: Number(req.body.goal),
    });

    if (!result.isEmpty()) {
      return res.json({
        errors: result.array(),
      });
    } else {
      let salt = bcrypt.genSaltSync(10);
      let hash = bcrypt.hashSync(req.body.password, salt);
      user.password = hash;
      let newuser = await user.save();
      res.json(newuser);
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
        const body = { _id: authuser._id, username: authuser.username };
        const token = jwt.sign({ user: body }, secret);
        if (typeof window !== "undefined") {
          localStorage.setItem("jwt", JSON.stringify(token));
        }
        return res.json({ token });
      }
    },
  )(req, res, next);
});

app.post("/plan", upload.any(), [
  body("planname", "Please enter a plan name")
    .trim()
    .isLength({ min: 1 })
    .escape(),
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);

    const plan = new Plan({
      name: req.body.planname,
      user: req.body.user,
    });
    if (!errors.isEmpty()) {
      return res
        .status(404)
        .json({ message: "Incorrect username or password", status: 404 });
    } else {
      let newplan = await plan.save();
      res.json(newplan);
    }
  }),
]);

app.put("/user/:userid", [
  body("goal", "Calorie goal must not be empty")
    .custom((value) => {
      const amount = Number(value);
      const amountFloat = Number(amount.toFixed(0));
      return amountFloat > 0;
    })
    .withMessage("Amount must be greater than 0"),
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      res.json({
        errors: errors.array(),
      });
      return;
    } else {
      const user = await User.findByIdAndUpdate(
        req.params.userid,
        { $set: { goal: Number(req.body.goal) } },
        { returnDocument: "after" },
      ).exec();
      res.json(user);
    }
  }),
]);

app.get(
  "/plans/:userid",
  asyncHandler(async (req, res, next) => {
    const plans = await Plan.find({ user: req.params.userid }).exec();

    if (plans === null) {
      return res.status(404).json({ message: "Plans not found", status: 404 });
    }

    res.json(plans);
  }),
);

app.get(
  "/user/:userid",
  asyncHandler(async (req, res, next) => {
    const user = await User.findById(req.params.userid).exec();

    if (user === null) {
      return res.status(404).json({ message: "User not found", status: 404 });
    }

    res.json(user);
  }),
);

app.get(
  "/plan/:planid",
  asyncHandler(async (req, res, next) => {
    const plan = await Plan.findById(req.params.planid).exec();

    if (plan === null) {
      return res.status(404).json({ message: "Plan not found", status: 404 });
    }

    res.json(plan);
  }),
);

app.get(
  "/item/:itemtype/:pageid",
  asyncHandler(async (req, res, next) => {
    const itemtype = req.params.itemtype;
    const pageno = req.params.pageid;

    try {
      const response = await axios.get(
        `https://www.tesco.com/groceries/en-GB/search?query=${itemtype}&page=${pageno}`,
        {
          headers: {
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
          },
        },
      );

      const html = response.data;
      const $ = cheerio.load(html);

      const itemlist = $(".hXcydL > .xZAYu")
        .map((i, element) => $(element).text())
        .get();
      const pricelist = $(".beans-price__text")
        .map((i, element) => $(element).text())
        .get();
      const linklist = $(".gbIAbl > .hXcydL")
        .map((i, element) => {
          const href = $(element).attr("href");
          const prodindx = href.indexOf("products");
          const start = prodindx + 9;
          const productno = href.slice(start);
          return productno;
        })
        .get();

      let iteminfo = {
        names: itemlist,
        prices: pricelist,
        links: linklist,
      };

      if (itemlist.length == 0) {
        res.status(404).json({ message: "No results", status: 404 });
      } else {
        res.json(iteminfo);
      }
    } catch (error) {
      next(error);
    }
  }),
);

app.post("/meal/:planid", upload.any(), [
  body("mealname", "Please enter a meal name")
    .trim()
    .isLength({ min: 1 })
    .escape(),
  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);

    const meal = new Meal({
      name: req.body.mealname,
      ingredients: [],
      plan: req.params.planid,
      user: req.body.user,
    });
    if (!errors.isEmpty()) {
      return res
        .status(404)
        .json({ message: "Please enter a meal name", status: 404 });
    } else {
      let savedmeal = await meal.save();
      let plan = await Plan.findByIdAndUpdate(
        req.params.planid,
        {
          $push: { meals: savedmeal },
        },
        { returnDocument: "after" },
      ).exec();

      res.json(plan);
    }
  }),
]);

app.get(
  "/item/info/:itemlink/:mealid/:planid",
  asyncHandler(async (req, res, next) => {
    const link = req.params.itemlink;
    const meal = req.params.mealid;
    const plan = req.params.planid;
    puppeteer
      .launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      })
      .then(async function (browser) {
        const page = await browser.newPage();
        page.setUserAgent(ua);
        await page.goto(
          `https://www.tesco.com/groceries/en-GB/products/${link}`,
        );
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
        const title = await page.$eval(".kdSqXr", (el) => el.innerText);
        const priceunf = await page.$eval(".eNIEDh", (el) => el.innerText);
        const price = Number(priceunf.slice(1));
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

        for (let i = 2 + shift; i < 9 + shift; i++) {
          const unftext = await page.$eval(
            `.product__info-table > tbody > tr:nth-child(${i}) > td:nth-child(2)`,
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
          fat: categories[0],
          saturated: categories[1],
          carbohydrate: categories[2],
          sugars: categories[3],
          fibre: categories[4],
          protein: categories[5],
          salt: categories[6],
          cost: price,
          quantity: 1,
          meal: meal,
          size: size,
        });
        const newing = await ingredient.save();
        const newmeal = await Meal.findByIdAndUpdate(
          meal,
          { $push: { ingredients: newing } },
          { returnDocument: "after" },
        ).exec();
        const ogplan = await Plan.findById(plan).exec();
        const meals = ogplan.meals;
        const index = meals.findIndex((object) => {
          return object._id.toString() == newmeal._id.toString();
        });
        meals[index] = newmeal;
        let newplan = await Plan.findByIdAndUpdate(
          plan,
          {
            $set: { meals: meals },
          },
          { returnDocument: "after" },
        );
        console.log(newplan);
        res.json(newplan);
      });
  }),
);

app.put("/meals/:mealid/:ingredientid/:planid", upload.any(), [
  body("quantity")
    .exists({ checkFalsy: true })
    .withMessage("You must enter an amount")
    .custom((value) => {
      const amount = Number(value);
      const amountFloat = Number(amount.toFixed(2));
      return amountFloat > 0 && amountFloat <= 10;
    })
    .withMessage("Serving sizes limited between 0 and 10"),

  asyncHandler(async (req, res, next) => {
    const errors = validationResult(req);

    const meal = await Meal.findById(req.params.mealid).exec();

    if (!errors.isEmpty()) {
      res.json({
        errors: errors.array(),
      });
      return;
    } else {
      let altingredients = meal.ingredients;
      let ingindx = altingredients.findIndex(
        (element) => element._id == req.params.ingredientid,
      );
      altingredients[ingindx].quantity = Number(req.body.quantity);
      const updmeal = await Meal.findByIdAndUpdate(
        req.params.mealid,
        { $set: { ingredients: altingredients } },
        { returnDocument: "after" },
      ).exec();
      const ogplan = await Plan.findById(req.params.planid).exec();
      const meals = ogplan.meals;
      const index = meals.findIndex((object) => {
        return object._id.toString() == updmeal._id.toString();
      });
      meals[index] = updmeal;
      let newplan = await Plan.findByIdAndUpdate(
        req.params.planid,
        {
          $set: { meals: meals },
        },
        { returnDocument: "after" },
      );
      res.json(newplan);
    }
  }),
]);

app.delete(
  "/meals/:mealid/:ingredientid/:planid",
  asyncHandler(async (req, res, next) => {
    let meal = await Meal.findById(req.params.mealid).exec();
    let altingredients = meal.ingredients;
    let ingindx = altingredients.findIndex(
      (element) => element._id == req.params.ingredientid,
    );
    altingredients.splice(ingindx, 1);
    const updmeal = await Meal.findByIdAndUpdate(
      req.params.mealid,
      { $set: { ingredients: altingredients } },
      { returnDocument: "after" },
    ).exec();
    const ogplan = await Plan.findById(req.params.planid).exec();
    const meals = ogplan.meals;
    const index = meals.findIndex((object) => {
      return object._id.toString() == updmeal._id.toString();
    });
    meals[index] = updmeal;
    let newplan = await Plan.findByIdAndUpdate(
      req.params.planid,
      {
        $set: { meals: meals },
      },
      { returnDocument: "after" },
    );
    res.json(newplan);
  }),
);

app.delete(
  "/meals/:mealid/:planid",
  asyncHandler(async (req, res, next) => {
    let plan = req.params.planid;
    let ogmeal = req.params.mealid;
    let ogplan = await Plan.findById(plan).exec();
    let meals = ogplan.meals;
    const index = meals.findIndex((object) => {
      return object._id.toString() == ogmeal.toString();
    });
    meals.splice(index, 1);
    let updplan = await Plan.findByIdAndUpdate(
      plan,
      {
        $set: { meals: meals },
      },
      { returnDocument: "after" },
    ).exec();
    res.json(updplan);
  }),
);

app.delete(
  "/plans/:planid",
  asyncHandler(async (req, res, next) => {
    await Plan.findByIdAndDelete(req.params.planid).exec();
    res.json("deleted");
  }),
);

module.exports = app;
