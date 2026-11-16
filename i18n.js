// Hebrew interface for Chef World.
// The page is written in English. When Hebrew is chosen, every piece of interface
// text is swapped as it appears. Text people typed themselves (marked dir="auto") is left alone.
(function(){
  'use strict';
  var lang = 'en';
  try{ lang = localStorage.getItem('cw_lang') || ''; }catch(e){}
  if(lang !== 'he' && lang !== 'en') lang = (navigator.language || '').toLowerCase().indexOf('he') === 0 ? 'he' : 'en';
  window.cwLang = lang;
  if(lang !== 'he'){ window.cwT = function(s){ return s; }; return; }

  var D = {
    // navigation and general
    'Loading Chef World…':'טוען את Chef World…','Timer':'טיימר','Settings':'הגדרות','Home':'בית','Recipes':'מתכונים','Shopping':'קניות','Plan':'תכנון','Community':'קהילה',
    'New recipe':'מתכון חדש','New Recipe':'מתכון חדש','Edit Recipe':'עריכת מתכון','Back':'חזרה','Cancel':'ביטול','Close':'סגירה','Save':'שמירה','Done':'סיום','Done!':'סיימתי!','Search':'חיפוש','Remove':'הסרה','Undo':'ביטול הפעולה','Main':'ראשי',
    'Something went wrong. Please try again.':'משהו השתבש. נסו שוב.','Could not save. Please try again.':'השמירה לא הצליחה. נסו שוב.',
    // library
    'My recipes':'המתכונים שלי','Favorites':'מועדפים','Quick, up to 30 min':'מהיר, עד 30 דקות','Not cooked yet':'עוד לא בישלתי','Folders':'תיקיות','Surprise me':'הפתיעו אותי','More filters':'עוד סינונים',
    'Tag':'תגית','All tags':'כל התגיות','Untagged':'בלי תגית','All folders':'כל התיקיות','Sort by':'מיון לפי','Newest first':'החדשים קודם','Name (A–Z)':'שם (א–ת)','Shortest prep':'ההכנה הקצרה ביותר','Recently cooked':'בושלו לאחרונה','Most cooked':'בושלו הכי הרבה','My top rated':'הדירוג שלי',
    'Prep time':'זמן הכנה','Any prep time':'כל זמן הכנה','Up to 15 min':'עד 15 דקות','Up to 30 min':'עד 30 דקות','Up to 60 min':'עד 60 דקות',
    "What's in my fridge?":'מה יש לי במקרר?','Invent a recipe from these':'המציאו לי מתכון מהמצרכים האלה','eggs, milk, flour':'ביצים, חלב, קמח','Search my recipes':'חיפוש במתכונים שלי',
    'No recipes yet':'עדיין אין מתכונים','Tap "New recipe" to add your first one':'לחצו על "מתכון חדש" כדי להוסיף את הראשון','Add example recipes':'הוספת מתכונים לדוגמה','No matching recipes found':'לא נמצאו מתכונים מתאימים',
    'recipes':'מתכונים','You have':'יש לכם','min':'דק׳','servings':'מנות','Easy':'קל','Medium':'בינוני','Hard':'קשה','Remove from favorites':'הסרה מהמועדפים','Add to favorites':'הוספה למועדפים',
    'Example recipes were added':'נוספו מתכונים לדוגמה','Saved to your recipes':'נשמר במתכונים שלכם','Recipe saved':'המתכון נשמר','The recipe was moved to the trash':'המתכון הועבר לאשפה',
    // shopping
    'Shopping list':'רשימת קניות','Add':'הוספה','Your shopping list is empty':'רשימת הקניות ריקה','Add items here, or open a recipe and tap "Add to shopping list"':'הוסיפו פריטים כאן, או פתחו מתכון ולחצו על "הוספה לרשימת הקניות"',
    'Send on WhatsApp':'שליחה בוואטסאפ','Copy list':'העתקת הרשימה','Remove bought items':'הסרת מה שנקנה','Clear list':'ניקוי הרשימה','Add an item, for example milk':'הוסיפו פריט, למשל חלב','Add an item':'הוספת פריט',
    'left to buy':'נשארו לקנות','in the basket':'בסל','The list was copied':'הרשימה הועתקה','The list was cleared':'הרשימה נוקתה','Added to the shopping list':'נוסף לרשימת הקניות','Open list':'פתיחת הרשימה','This recipe has no ingredients':'למתכון הזה אין מצרכים',
    // plan
    'Meal plan':'תכנון ארוחות','Earlier':'קודם','Later':'הבא','Add this week to the shopping list':'הוספת השבוע לרשימת הקניות','Fill empty days for me':'מלאו לי את הימים הריקים','Clear this week':'ניקוי השבוע',
    'Today':'היום','Tomorrow':'מחר','Which day?':'לאיזה יום?','Added to the meal plan':'נוסף לתכנון הארוחות','Open plan':'פתיחת התכנון','This recipe is no longer in your recipes':'המתכון הזה כבר לא נמצא במתכונים שלכם','Nothing planned':'אין תכנון',
    'Plan some recipes for this week first':'קודם תכננו מתכונים לשבוע הזה','Every day this week already has a plan':'לכל הימים בשבוע כבר יש תכנון','The week is planned. You can change any day.':'השבוע מתוכנן. אפשר לשנות כל יום.','Clear the plan for this week?':'לנקות את התכנון של השבוע הזה?',
    'Nothing here yet':'עדיין אין כאן כלום','You have no recipes yet':'עדיין אין לכם מתכונים',
    // community
    'All recipes':'כל המתכונים','Following':'במעקב','Language':'שפה','All languages':'כל השפות','Top rated':'הדירוג הגבוה','Most liked':'הכי אהובים','No published recipes yet':'עדיין לא פורסמו מתכונים','Search community recipes':'חיפוש במתכוני הקהילה',
    'by':'מאת','Chef':'שף','Guest':'אורח','Signed in':'מחובר','You follow:':'אתם עוקבים אחרי:','The chefs you follow have not published anything yet':'השפים שאתם עוקבים אחריהם עוד לא פרסמו כלום','You are not following anyone yet':'אתם עוד לא עוקבים אחרי אף אחד','Open a community recipe and tap "Follow chef"':'פתחו מתכון מהקהילה ולחצו על "מעקב אחרי השף"',
    'Follow chef':'מעקב אחרי השף','Like':'אהבתי','Liked':'אהבתי','No ratings yet':'עדיין אין דירוגים','No reviews yet. Be the first!':'עדיין אין ביקורות. היו הראשונים!',
    'English':'אנגלית','Hebrew':'עברית','Spanish':'ספרדית','French':'צרפתית','German':'גרמנית','Italian':'איטלקית','Portuguese':'פורטוגזית','Arabic':'ערבית','Russian':'רוסית','Chinese':'סינית','Japanese':'יפנית','Other':'אחר','Original':'מקורי','Metric':'מטרי','US':'אמריקאי',
    // form
    'Fill it in for me with AI':'מלאו לי את זה עם בינה מלאכותית','Paste recipe text, a link or a YouTube video link, add a photo or file, or tap the microphone and just say the recipe.':'הדביקו טקסט של מתכון, קישור או קישור לסרטון יוטיוב, הוסיפו תמונה או קובץ, או לחצו על המיקרופון ופשוט אמרו את המתכון.','Take photo':'צילום','Photo or file':'תמונה או קובץ','Reading the photo…':'קורא את התמונה…','Up to 6 files':'עד 6 קבצים','The file is too large (up to 15 MB)':'הקובץ גדול מדי (עד 15MB)','That file type is not supported':'סוג הקובץ לא נתמך','Could not read that file':'לא הצלחתי לקרוא את הקובץ','Original recipe link (optional)':'קישור למתכון המקורי (לא חובה)','Original recipe':'המתכון המקורי','Create recipe':'יצירת מתכון','Speak':'דיבור','Stop listening':'הפסקת ההקשבה',
    'Recipe name':'שם המתכון','Picture (emoji)':'תמונה (אימוג׳י)','Prep time (minutes)':'זמן הכנה (דקות)','Cook time (minutes)':'זמן בישול (דקות)','Amount':'כמות','Amount unit':'יחידת הכמות','Tags (separate with commas)':'תגיות (מופרדות בפסיקים)','Difficulty':'רמת קושי','Choose difficulty':'בחרו רמת קושי',
    'Ingredients':'מצרכים','Add ingredient':'הוספת מצרך','Add section (e.g. Dough, Filling)':'הוספת חלק (למשל בצק, מילוי)','Add section':'הוספת חלק','Steps':'שלבים','Add step':'הוספת שלב','Notes (optional)':'הערות (לא חובה)','Notes':'הערות','Save Recipe':'שמירת המתכון',
    'Paste recipe text or a link here':'הדביקו כאן טקסט של מתכון או קישור','e.g. Creamy Mushroom Pasta':'למשל פסטה שמנת פטריות','servings, cookies, pieces...':'מנות, עוגיות, חתיכות...','Vegetarian, Italian, Quick':'צמחוני, איטלקי, מהיר','Vegetarian, Italian':'צמחוני, איטלקי','Tips, variations...':'טיפים, גרסאות...','Translated notes':'הערות מתורגמות',
    'Qty':'כמות','Unit':'יחידה','Ingredient':'מצרך','e.g. 200g flour':'למשל 200 גרם קמח','e.g. 2 eggs':'למשל 2 ביצים','Section name, e.g. Dough':'שם החלק, למשל בצק','Step description':'תיאור השלב','Wait time in minutes (leave empty if no waiting is needed)':'זמן המתנה בדקות (להשאיר ריק אם אין המתנה)',
    'Please enter a recipe name':'כתבו שם למתכון','Please add at least one step':'הוסיפו לפחות שלב אחד',
    'It did not work. Please try again.':'זה לא הצליח. נסו שוב.','The recipe is filled in. Check it and tap Save.':'המתכון מולא. בדקו אותו ולחצו על שמירה.','Paste or say the recipe first.':'קודם הדביקו או אמרו את המתכון.','Reading the page…':'קורא את הדף…','Watching the video…':'צופה בסרטון…','Working on it…':'עובד על זה…','Inventing a recipe…':'ממציא מתכון…','Translating…':'מתרגם…',
    // AI import: live stages and errors
    'Checking the connection…':'בודק את החיבור…','The AI is opening the page…':'ה-AI פותח את הדף…','The AI is watching the video…':'ה-AI צופה בסרטון…','The AI is reading the files…':'ה-AI קורא את הקבצים…','The AI is reading the recipe…':'ה-AI קורא את המתכון…','It failed, trying again with a new connection…':'זה נכשל, מנסה שוב עם חיבור חדש…','The video could not be watched, reading its page instead…':'אי אפשר היה לצפות בסרטון, קורא את הדף שלו במקום…','The AI could not open the site, fetching the page another way…':'ה-AI לא הצליח לפתוח את האתר, מביא את הדף בדרך אחרת…','Page fetched, the AI is reading it…':'הדף הגיע, ה-AI קורא אותו…','The answer came back broken, asking again…':'התשובה הגיעה שבורה, שואל שוב…','Filling in the form…':'ממלא את הטופס…','Receiving the recipe':'המתכון מתקבל','ingredients':'מצרכים','steps':'שלבים',
    'The site did not let us read the page. Copy the recipe text from the site and paste it here.':'האתר לא איפשר לקרוא את הדף. העתיקו את טקסט המתכון מהאתר והדביקו אותו כאן.','No recipe was found there. Check the link, or paste the recipe text.':'לא נמצא שם מתכון. בדקו את הקישור, או הדביקו את טקסט המתכון.','The security check failed on this device. Close the app completely, open it again and retry.':'בדיקת האבטחה נכשלה במכשיר הזה. סגרו את האפליקציה לגמרי, פתחו אותה שוב ונסו שוב.','The AI is busy right now. Wait a minute and try again.':'ה-AI עמוס כרגע. חכו דקה ונסו שוב.','No internet connection. Check it and try again.':'אין חיבור לאינטרנט. בדקו אותו ונסו שוב.','A new version of Chef World is ready.':'גרסה חדשה של Chef World מוכנה.','Refresh':'רענון',
    'Microphone access was blocked.':'הגישה למיקרופון נחסמה.','Listening… say the recipe, then tap "Create recipe".':'מקשיב… אמרו את המתכון ואז לחצו על "יצירת מתכון".','First type what you have at home':'קודם כתבו מה יש לכם בבית','The translation did not work. Please try again.':'התרגום לא הצליח. נסו שוב.',
    'Manual translation':'תרגום ידני','Show translation':'הצגת התרגום',
    // detail
    'Start cooking':'מתחילים לבשל','Favorite':'מועדף','Favorited':'במועדפים','Save to My Recipes':'שמירה במתכונים שלי','Add to shopping list':'הוספה לרשימת הקניות','Add to meal plan':'הוספה לתכנון הארוחות','Send recipe':'שליחת המתכון','Copy link':'העתקת קישור','WhatsApp':'וואטסאפ',
    'Edit':'עריכה','Print':'הדפסה','More options':'אפשרויות נוספות','Publish':'פרסום','Translate':'תרגום','Duplicate':'שכפול','Delete':'מחיקה','Instructions':'אופן ההכנה','Prep':'הכנה','Cook':'בישול','Less':'פחות','More':'יותר',
    'Cooked':'בושל','times':'פעמים','Last cooked':'בושל לאחרונה','My rating':'הדירוג שלי','A copy was saved to your recipes':'עותק נשמר במתכונים שלכם',
    'Ask the AI chef':'שאלו את השף החכם','Replace an ingredient':'להחליף מצרך','Make it healthier':'לעשות את זה בריא יותר','What to serve with it':'מה להגיש לצד זה','Tips for success':'טיפים להצלחה','Ask':'שאלה','Ask anything about this recipe':'שאלו כל דבר על המתכון הזה',
    'Which ingredients can I replace, and with what?':'אילו מצרכים אפשר להחליף, ובמה?','How can I make this recipe healthier?':'איך אפשר לעשות את המתכון הזה בריא יותר?','What goes well as a side dish with this?':'מה מתאים כתוספת לצד המנה הזאת?','Give me tips so this recipe does not fail.':'תנו לי טיפים כדי שהמתכון הזה יצליח.',
    'Thinking…':'חושב…','The AI chef is not available right now. Please try again.':'השף החכם לא זמין כרגע. נסו שוב.',
    'Ratings & reviews':'דירוגים וביקורות','Post review':'פרסום ביקורת','Update review':'עדכון הביקורת','Delete my review':'מחיקת הביקורת שלי','Share how it turned out (optional)':'ספרו איך יצא (לא חובה)','Pick a star rating first.':'קודם בחרו דירוג בכוכבים.','Thanks! Your review is saved.':'תודה! הביקורת נשמרה.','Could not save your review. Please try again.':'שמירת הביקורת לא הצליחה. נסו שוב.','Could not delete your review.':'מחיקת הביקורת לא הצליחה.','Could not update follow. Please try again.':'עדכון המעקב לא הצליח. נסו שוב.',
    'This recipe link is no longer available.':'הקישור למתכון הזה כבר לא זמין.','Copy this link:':'העתיקו את הקישור הזה:',
    // cook mode and timers
    'Exit':'יציאה','Gather your ingredients':'אוספים את המצרכים',"Everything you'll need":'כל מה שצריך','Start Cooking':'מתחילים לבשל','Next':'הבא','Read aloud':'הקראה','Stop':'עצירה','Step':'שלב','Start timer':'הפעלת טיימר','Stop timer':'עצירת הטיימר','Time is up!':'הזמן נגמר!',
    'This recipe has no steps yet':'למתכון הזה עדיין אין שלבים','Complete!':'הושלם!','Bon appétit!':'בתיאבון!','Your dish is ready — enjoy the meal':'המנה מוכנה — תיהנו מהארוחה','days in a row':'ימים ברצף','How did it turn out?':'איך יצא?','Back to steps':'חזרה לשלבים','Finish':'סיום',
    'Listening… say “next”, “back”, “repeat”, “timer” (הבא, חזור, שוב, טיימר)':'מקשיב… אמרו "הבא", "חזור", "שוב" או "טיימר"',
    'Kitchen timer':'טיימר מטבח','Choose how many minutes. The timer keeps running while you use the app.':'בחרו כמה דקות. הטיימר ממשיך לפעול בזמן שאתם משתמשים באפליקציה.','Minutes':'דקות','What is it for? (optional)':'בשביל מה? (לא חובה)','Choose how many minutes':'בחרו כמה דקות','Timer started':'הטיימר הופעל',
    // home and achievements
    'Good night':'לילה טוב','Good morning':'בוקר טוב','Good afternoon':'צהריים טובים','Good evening':'ערב טוב','What should I cook?':'מה לבשל היום?','Continue cooking':'ממשיכים לבשל','Continue':'המשך','Planned for today':'מתוכנן להיום','My kitchen':'המטבח שלי','My achievements':'ההישגים שלי',
    'Cooked recently':'בישלתי לאחרונה','Recipe of the day from the community':'מתכון היום מהקהילה','Level':'רמה','XP to the next level':'נקודות לרמה הבאה','dishes cooked':'מנות שבושלו','badges':'תגי הישג','Badges':'תגי הישג','Cooking diary':'יומן בישול','Dishes you finish cooking will show up here.':'מנות שתסיימו לבשל יופיעו כאן.',
    'Kitchen newcomer':'חדשים במטבח','Home cook':'בשלן ביתי','Skilled cook':'בשלן מיומן','Sous chef':'סו-שף','Master chef':'מאסטר שף',
    'First recipe':'מתכון ראשון','Add your first recipe':'הוסיפו את המתכון הראשון','Recipe collector':'אספן מתכונים','Keep 10 recipes':'שמרו 10 מתכונים','First dish':'מנה ראשונה','Finish cooking a recipe':'סיימו לבשל מתכון','Ten dishes':'עשר מנות','Finish cooking 10 times':'סיימו לבשל 10 פעמים','Fifty dishes':'חמישים מנות','Finish cooking 50 times':'סיימו לבשל 50 פעמים',
    'On a roll':'ברצף','Cook 3 days in a row':'בשלו 3 ימים ברצף','Full week':'שבוע מלא','Cook 7 days in a row':'בשלו 7 ימים ברצף','Mark 5 favorite recipes':'סמנו 5 מתכונים מועדפים','Planner':'מתכננים','Add a recipe to the meal plan':'הוסיפו מתכון לתכנון הארוחות','Sharing is caring':'לשתף זה כיף','Publish a recipe':'פרסמו מתכון','Food critic':'מבקר אוכל','Review a community recipe':'כתבו ביקורת על מתכון מהקהילה','Good company':'חברה טובה','Follow a chef':'עקבו אחרי שף',
    'Another one':'משהו אחר','Open recipe':'פתיחת המתכון',
    // settings
    'Welcome to Chef World! Choose what is comfortable for you. You can change it any time with the Settings button.':'ברוכים הבאים ל-Chef World! בחרו מה שנוח לכם. אפשר לשנות בכל רגע בכפתור ההגדרות.','Text size':'גודל הכתב','Normal':'רגיל','Large':'גדול','Extra large':'גדול מאוד','Simple mode':'מצב פשוט','Bigger buttons and only the main options':'כפתורים גדולים יותר ורק האפשרויות העיקריות',
    'Colors':'צבעים','Light':'בהיר','Dark':'כהה','High contrast':'ניגודיות גבוהה','Chef name':'שם השף','Shown next to recipes you publish and reviews you write.':'מוצג ליד מתכונים שאתם מפרסמים וביקורות שאתם כותבים.','Your chef name':'שם השף שלכם','Your chef name was saved':'שם השף נשמר','Account':'חשבון','Connect Claude':'חיבור ל-Claude','Sign out':'התנתקות',
    'Backup and trash':'גיבוי ואשפה','Export':'ייצוא','Import':'ייבוא','Trash':'אשפה','How does it work?':'איך זה עובד?',
    'Recipes: all your recipes. Tap one to open it, then tap "Start cooking" to follow it step by step.':'מתכונים: כל המתכונים שלכם. לחצו על מתכון כדי לפתוח אותו, ואז על "מתחילים לבשל" כדי לעבור עליו שלב אחרי שלב.','Shopping: a list of what to buy. Tap an item when it is in your basket.':'קניות: רשימה של מה לקנות. לחצו על פריט כשהוא כבר בסל.','Plan: choose what to cook on each day of the week.':'תכנון: בחרו מה לבשל בכל יום בשבוע.','Community: recipes other people shared. You can save them to your own recipes.':'קהילה: מתכונים שאנשים אחרים שיתפו. אפשר לשמור אותם במתכונים שלכם.','While cooking you can say "next" or "back" out loud, so your hands stay free.':'בזמן הבישול אפשר להגיד בקול "הבא" או "חזור", וכך הידיים נשארות פנויות.',
    'No recipes to export yet.':'עדיין אין מתכונים לייצוא.','This file is not valid JSON.':'הקובץ הזה לא תקין.','No recipes were found in this file.':'לא נמצאו מתכונים בקובץ הזה.','No valid recipes were found in this file.':'לא נמצאו מתכונים תקינים בקובץ הזה.','Import stopped part-way. Some recipes may not have been saved.':'הייבוא נעצר באמצע. ייתכן שחלק מהמתכונים לא נשמרו.',
    'The trash is empty.':'האשפה ריקה.','Restore':'שחזור','Delete forever':'מחיקה לצמיתות','Delete this recipe forever? This cannot be undone.':'למחוק את המתכון הזה לצמיתות? אי אפשר לבטל את זה.','Deleted recipes stay here for 30 days.':'מתכונים שנמחקו נשארים כאן 30 יום.',
    // publish, connect, delete, language
    'Publish this recipe. Pick a language and who can see it:':'פרסום המתכון. בחרו שפה ומי יכול לראות אותו:','Public — listed in Community':'ציבורי — מופיע בקהילה','Unlisted — only people with the link':'לא רשום — רק למי שיש קישור','Unpublish':'ביטול הפרסום','Published! Click "Copy link" to share it.':'פורסם! לחצו על "העתקת קישור" כדי לשתף.','Link copied to clipboard!':'הקישור הועתק!','Link ready above.':'הקישור מוכן למעלה.','Link shown in the prompt — copy it manually.':'הקישור מוצג בחלון — העתיקו אותו ידנית.','Link copied.':'הקישור הועתק.','Select the link above and copy it.':'סמנו את הקישור למעלה והעתיקו אותו.',
    'Create your own key for any app or script and send it as an Authorization: Bearer header to the address below. A key can read, edit and delete everything in your account, so keep it private. You can revoke it here at any time.':'צרו מפתח משלכם לכל אפליקציה או סקריפט ושלחו אותו בכותרת Authorization: Bearer לכתובת למטה. מפתח יכול לקרוא, לערוך ולמחוק הכול בחשבון שלכם, לכן שמרו אותו פרטי. אפשר לבטל אותו כאן בכל רגע.','Key name, e.g. My app':'שם המפתח, למשל האפליקציה שלי','Create key':'יצירת מפתח','Copy new key':'העתקת המפתח החדש','Revoke':'ביטול','✅ Key revoked.':'✅ המפתח בוטל.','Could not revoke the key.':'לא הצלחנו לבטל את המפתח.','✅ Key created. Copy it now: it is shown only once.':'✅ המפתח נוצר. העתיקו אותו עכשיו: הוא מוצג פעם אחת בלבד.','Could not create the key.':'לא הצלחנו ליצור מפתח.',
    'API for anything else':'API לכל דבר אחר','Use your recipes from any app or script: send the key as an Authorization: Bearer header to the address below. The key acts as you, so keep it private.':'השתמשו במתכונים שלכם מכל אפליקציה או סקריפט: שלחו את המפתח בכותרת Authorization: Bearer לכתובת למטה. המפתח פועל בשמכם, לכן שמרו אותו פרטי.','Copy API address':'העתקת כתובת ה-API','Copy API key':'העתקת מפתח ה-API','✅ API address copied.':'✅ כתובת ה-API הועתקה.','✅ API key copied.':'✅ מפתח ה-API הועתק.','Select the address above and copy it.':'סמנו את הכתובת למעלה והעתיקו אותה.','Select the key above and copy it.':'סמנו את המפתח למעלה והעתיקו אותו.',
    'Paste this link into claude.ai as a custom connector. Claude then works with your recipes as you: it can read, create, edit, publish and delete them.':'הדביקו את הקישור הזה ב-claude.ai כמחבר מותאם אישית. מאז Claude עובד עם המתכונים שלכם בשמכם: הוא יכול לקרוא, ליצור, לערוך, לפרסם ולמחוק אותם.','Anyone with this link can act as you. Signing out everywhere revokes it. Do not share it.':'כל מי שיש לו את הקישור הזה יכול לפעול בשמכם. התנתקות מכל המכשירים מבטלת אותו. אל תשתפו אותו.',
    'Move this recipe to the trash? You can restore it within 30 days.':'להעביר את המתכון הזה לאשפה? אפשר לשחזר אותו בתוך 30 יום.','Yes, move to trash':'כן, להעביר לאשפה','Choose a language. The original recipe will not be changed.':'בחרו שפה. המתכון המקורי לא ישתנה.','Translate with AI':'תרגום אוטומטי','Translate manually':'תרגום ידני',
    // sign in
    'Sign In':'כניסה','Sign Up':'הרשמה','Email':'אימייל','Password':'סיסמה','Create Account':'יצירת חשבון','or':'או','Continue with Google':'המשך עם Google','Continue as Guest':'המשך כאורח',
    'That email is already registered.':'האימייל הזה כבר רשום.','That email address looks invalid.':'כתובת האימייל לא נראית תקינה.','Password should be at least 6 characters.':'הסיסמה צריכה להיות באורך 6 תווים לפחות.','Incorrect email or password.':'האימייל או הסיסמה שגויים.','Sign-in popup was closed before completing.':'חלון הכניסה נסגר לפני הסיום.','This sign-in method is not enabled for this project yet.':'שיטת הכניסה הזאת עדיין לא מופעלת.'
  };
  var P = [
    [/^Step (\d+) of (\d+)$/, function(m){ return 'שלב ' + m[1] + ' מתוך ' + m[2]; }],
    [/^(\d+) days left$/, function(m){ return 'נשארו ' + m[1] + ' ימים'; }],
    [/^(\d+) min$/, function(m){ return m[1] + ' דק׳'; }],
    [/^Units: (.+)$/, function(m){ return 'יחידות: ' + tr(m[1]); }],
    [/^Hands-free: (On|Off)$/, function(m){ return 'שליטה בקול: ' + (m[1] === 'On' ? 'פועלת' : 'כבויה'); }],
    [/^Heard: (.*)$/, function(m){ return 'שמעתי: ' + m[1]; }],
    [/^from (\d+) reviews?$/, function(m){ return 'מתוך ' + m[1] + ' ביקורות'; }],
    [/^(.*) \(you\)$/, function(m){ return m[1] + ' (אני)'; }],
    [/^Imported (\d+) recipe\(s\)\.$/, function(m){ return 'יובאו ' + m[1] + ' מתכונים.'; }],
    [/^Import (\d+) recipe\(s\)\?/, function(m){ return 'לייבא ' + m[1] + ' מתכונים? מתכונים עם אותו מזהה כמו מתכון קיים יעודכנו.'; }],
    [/^Translating to (.+)\. The original recipe will not be changed\.$/, function(m){ return 'תרגום ל' + tr(m[1]) + '. המתכון המקורי לא ישתנה.'; }],
    [/^(Liked?) · (\d+)$/, function(m){ return tr(m[1]) + ' · ' + m[2]; }]
  ];
  var has = Object.prototype.hasOwnProperty;
  function core(s){
    if(has.call(D, s)) return D[s];
    for(var i = 0; i < P.length; i++){ var m = P[i][0].exec(s); if(m) return P[i][1](m); }
    return null;
  }
  function flip(s){ return s.replace(/[←→]/g, function(c){ return c === '←' ? '→' : '←'; }); }
  function tr(s){
    if(typeof s !== 'string' || !/[A-Za-z]/.test(s)) return s;
    var lead = /^\s*/.exec(s)[0], tail = /\s*$/.exec(s)[0];
    var t = s.trim();
    var hit = core(t);
    if(hit != null) return lead + hit + tail;
    var pre = /^[^A-Za-z0-9]*/.exec(t)[0];
    var rest = t.slice(pre.length);
    var suf = /[^A-Za-z0-9.!?…)"”:]*$/.exec(rest)[0];
    var mid = suf ? rest.slice(0, rest.length - suf.length) : rest;
    if(!pre && !suf) return s;
    hit = core(mid);
    return hit == null ? s : lead + flip(pre) + hit + flip(suf) + tail;
  }
  window.cwT = tr;

  var ATTRS = ['placeholder', 'aria-label', 'title'];
  function skip(el){ return !el || !el.closest || !!el.closest('[dir="auto"],script,style,textarea'); }
  function textNode(n){
    if(skip(n.parentNode)) return;
    var v = n.nodeValue, t = tr(v);
    if(t !== v) n.nodeValue = t;
  }
  function attrs(el){
    for(var i = 0; i < ATTRS.length; i++){
      var v = el.getAttribute(ATTRS[i]);
      if(v){ var t = tr(v); if(t !== v) el.setAttribute(ATTRS[i], t); }
    }
  }
  function walk(root){
    if(root.nodeType === 3){ textNode(root); return; }
    if(root.nodeType !== 1) return;
    attrs(root);
    var els = root.querySelectorAll('[placeholder],[aria-label],[title]');
    for(var i = 0; i < els.length; i++) attrs(els[i]);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), n;
    while((n = w.nextNode())) textNode(n);
  }
  function start(){
    walk(document.body);
    new MutationObserver(function(list){
      for(var i = 0; i < list.length; i++){
        var m = list[i];
        if(m.type === 'characterData') textNode(m.target);
        else if(m.type === 'attributes') attrs(m.target);
        else for(var k = 0; k < m.addedNodes.length; k++) walk(m.addedNodes[k]);
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  if(document.body) start(); else document.addEventListener('DOMContentLoaded', start);
})();
