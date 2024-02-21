const express = require("express");
const path = require("path");
const passport = require("passport");
const OAuth2Strategy = require("passport-oauth").OAuth2Strategy;
const AppExtensionsSDK = require("@pipedrive/app-extensions-sdk");

const api = require("./api");
const config = require("./config");
const User = require("./db/user");
const ACESS_TOKEN = "";
User.createTable();

const app = express();
const port = 3000;
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
const pipedrive = require("pipedrive");
const defaultClient = new pipedrive.ApiClient();
defaultClient.authentications.api_key.apiKey = process.env.PIPEDRIVE_API_KEY;

passport.use(
  "pipedrive",
  new OAuth2Strategy(
    {
      authorizationURL: "https://oauth.pipedrive.com/oauth/authorize",
      tokenURL: "https://oauth.pipedrive.com/oauth/token",
      clientID: config.clientID || "",
      clientSecret: config.clientSecret || "",
      callbackURL: config.callbackURL || "",
    },
    async (accessToken, refreshToken, profile, done) => {
      const userInfo = await api.getUser(accessToken);
      const user = await User.add(
        userInfo.data.name,
        accessToken,
        refreshToken
      );
      console.log(accessToken);
      done(null, { user });
    }
  )
);

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "hbs");

app.use(express.static(path.join(__dirname, "public")));
app.use(passport.initialize());
app.use(async (req, res, next) => {
  req.user = await User.getById(1);
  next();
});

app.get("/auth/pipedrive", passport.authenticate("pipedrive"));
app.get(
  "/auth/pipedrive/callback",
  passport.authenticate("pipedrive", {
    session: false,
    failureRedirect: "/",
    successRedirect: "/",
  })
);
app.get("/", async (req, res) => {
  try {
    res.render("form");
  } catch (error) {
    return res.send(error.message);
  }
});
app.post("/submit-form", async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      phone,
      email_,
      jobType,
      jobSource,
      jobDescription,
      address,
      city,
      state,
      zipCode,
      area,
      startDate,
      startTime,
      endTime,
      testSelect,
    } = req.body;

    const api = new pipedrive.DealsApi(defaultClient);
    const fieldsApi = new pipedrive.DealFieldsApi(defaultClient);
    let combinedAddress = `${address}, ${city}, ${state}, ${zipCode}, ${area}`;
    let name = `${firstName} ${lastName}`;
    const getDeals = await api.getDeals();
    const dealIds = getDeals.data.map((deal) => deal.id);
    const maxId = Math.max(...dealIds) + 1;
    console.log(maxId);
    let id_Created_Deal = getDeals;
    const data = {
      title: `Job #${maxId}`,
      value: 10000,
      currency: "USD",
      user_id: null,
      person_id: null,
      org_id: 1,
      stage_id: 1,
      status: "open",
      expected_close_date: "2022-02-11",
      probability: 60,
      lost_reason: null,
      visible_to: 1,
      add_time: "2021-02-11",
      email: email_,
    };
    const response = await api.addDeal(data);
    const DEAL_ID = response.data.id;
    const dealFields = await fieldsApi.getDealFields();
    const AdressField = dealFields.data.find(
      (field) => field.name === "Adress"
    );
    const Time_startField = dealFields.data.find(
      (field) => field.name === "Time_start"
    );
    const Time_endField = dealFields.data.find(
      (field) => field.name === "Time_end"
    );
    const NameField = dealFields.data.find(
      (field) => field.name === "Name"
    );
    const PhoneField = dealFields.data.find(
      (field) => field.name === "Phone"
    );
    const Job_typeField = dealFields.data.find(
      (field) => field.name === "Job type"
    );
    const Job_descField = dealFields.data.find(
      (field) => field.name === "Job desc"
    );
    const Job_sourceField = dealFields.data.find(
      (field) => field.name === "Job source"
    );
    const Start_DateField = dealFields.data.find(
      (field) => field.name === "Start Date"
    );
    const Test_selectField = dealFields.data.find(
      (field) => field.name === "Test select"
    );
    const updatedDeal = await api.updateDeal(DEAL_ID, {
      [AdressField.key]: combinedAddress,
      [Time_startField.key]: startTime,
      [Time_endField.key]: endTime,
      [NameField.key]: name,
      [PhoneField.key]: phone,
      [Job_typeField.key]: jobType,
      [Job_descField.key]: jobDescription,
      [Job_sourceField.key]: jobSource,
      [Start_DateField.key]: startDate,
      [Test_selectField.key]: testSelect
    });

    console.log("Deal was added successfully!", response);
    console.log(updatedDeal);
    const dealLink = `<a href="https://maxim-sandbox2.pipedrive.com/deal/${maxId}" target='_blank'>Ur created deal here</a>`;
    res.send(dealLink)
  } catch (error) {
    const errorToLog = error.context?.body || error;
    console.log("Adding failed", errorToLog);
  }
});
app.get("/deals/:id", async (req, res) => {
  const randomBoolean = Math.random() >= 0.5;
  const outcome = randomBoolean === true ? "won" : "lost";

  try {
    await api.updateDeal(req.params.id, outcome, req.user[0].access_token);

    res.render("outcome", { outcome });
  } catch (error) {
    return res.send(error.message);
  }
});
// End of `Step 2`
app.listen(port, () =>
  console.log(
    `🟢 App has started. \n🔗 Live URL: https://${process.env.PROJECT_DOMAIN}.glitch.me`
  )
);
