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
- **Manual translation**: write a translation of a recipe into another language.
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
- `firestore.rules`: Firestore security rules. Users can read and write only their own recipes. Any signed-in user can read published recipes, and only the owner can publish, update or remove them. Reviews are one per user per recipe, and followed chefs are private to each user. **Republish the rules** after updating, or ratings and follows will be denied.

## License

MIT. See [LICENSE](LICENSE).
