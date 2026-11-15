# Chef World

Chef World is a recipe app for keeping your own recipe library, cooking from it step by step, and sharing recipes with other people.

It is a single static page (`index.html`) that talks to Firebase directly from the browser. There is no build step and no server of its own.

## Features

- **Your library**: create, edit and delete recipes. Ingredients have quantities, units and optional sections (for example "Dough" and "Filling"). Servings are adjustable.
- **Import with AI**: paste recipe text or a link, and Gemini turns it into a structured recipe.
- **Cook mode**: a step-by-step view with an ingredient checklist and a timer.
- **Community**: publish a recipe as public or unlisted, tagged with its language. You can unpublish at any time.
- **Ratings and reviews**: rate public recipes from 1 to 5 stars and write a short review. Average ratings show on every card. You cannot review your own recipe.
- **Follow chefs**: follow the authors of public recipes. The Following tab is a feed of their newest recipes.
- **Smarter search**: filter by tag, maximum prep time and favorites, or list what is in your fridge to see the recipes you can make with it.
- **Hands-free cooking**: the screen stays on, steps can be read aloud, and voice commands work in Hebrew and English ("next" / הבא, "back" / חזור, "repeat" / שוב, "timer" / טיימר).
- **Translation**: translate a recipe with AI, or write the translation yourself.
- **Home screen**: a greeting, big shortcuts, "continue cooking", today's plan, your streak, level and recently cooked dishes.
- **Shopping list**: add items by hand or straight from a recipe or the weekly plan, tick them off, and send the list on WhatsApp.
- **Weekly meal plan**: pick recipes for each day, fill empty days automatically, and turn the week into a shopping list.
- **Kitchen timers**: several timers at once that keep running outside cook mode, with a repeating alarm.
- **AI helpers**: dictate a recipe, invent a recipe from what is in the fridge, and ask questions about the open recipe.
- **Achievements**: cooking diary, day streaks, levels and badges. Rate your own dishes when you finish cooking.
- **Likes and chef pages**: like community recipes, sort by most liked or top rated, and see everything one chef published.
- **Comfort settings**: three text sizes, light, dark and high-contrast colors, a simple mode with bigger buttons, and a Hebrew or English interface.
- **Works offline and installs like an app**: recipes are cached on the device, and the site can be added to the home screen.
- **Sign-in**: email and password, Google, or an anonymous guest account.

## Setup

You need your own Firebase project. The `firebaseConfig` in `index.html` belongs to the author's project, so replace it with yours.

1. Create a project in the [Firebase console](https://console.firebase.google.com).
2. **Authentication → Sign-in method**: enable Email/Password, Google and Anonymous.
3. **Firestore Database**: create a database, then publish the rules from `firestore.rules`. Paste them into the Rules tab, or deploy them with the Firebase CLI.
4. **Firebase AI Logic**: enable it with the Gemini Developer API backend.
5. **App Check**: register a reCAPTCHA Enterprise key for your domains. Add `localhost` if you test locally.
6. In `index.html`, replace:
   - the `firebaseConfig` object (Project settings → General → Your apps), and
   - the site key passed to `ReCaptchaEnterpriseProvider`.
7. Serve the folder over HTTP and open it in the browser:

   ```bash
   python -m http.server 8000
   ```

   Then go to <http://localhost:8000>. Firebase Auth and App Check expect a real origin, so opening the file directly is not reliable.

The Firebase web config is not a secret, but it should point at a project you control.

## Files

- `index.html`: the whole app, with markup, styles and script.
- `i18n.js`: the Hebrew interface texts.
- `sw.js`, `manifest.webmanifest`, `icon.svg`: offline support and home-screen install.
- `firestore.rules`: Firestore security rules. Users can read and write only their own recipes. Any signed-in user can read published recipes, and only the owner can publish, update or remove them. Reviews and likes are one per user per recipe. Followed chefs, the shopping list, the meal plan and the cooking log are private to each user. **Republish the rules** after updating, or ratings and follows will be denied.

## License

MIT. See [LICENSE](LICENSE).
