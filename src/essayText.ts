export const ESSAY_TEXT = `
---
title: "Embark" # Title will render in most places as "[title]: [subtitle]"
subtitle: "A computational outliner for travel"
# date: # REQUIRED. must be in the past.
draft: true
images:
  - "**/todo.jpg" # The first will be used in social previews. The rest are used for nothing as of now
# scripts: # Optional
#   - "**/app.js" # Scripts for adding interactivity to this essay.
# styles: # Optional
#   - "**/custom.css" # Styles specific to this essay.
authors:
  - name: "Paul Sonnentag"
    url: https://todo.com
  - name: "Alexander Obenauer"
    url: https://todo.com
  - name: "Geoffrey Litt"
    url: https://todo.com
type: essay
description: "" # 1-2 sentence summary for social previews.
---

Modern software is organized into applications which each host their own data and computational tools; users have limited ways to compose behavior across application boundaries. These limits are particularly apparent in tasks like travel planning, which require coordinating information across multiple tools in unique ways tailored to a specific trip.

We present a prototype called Embark which enables users to perform an entire travel planning process within a single outline document enriched with computational tools. In Embark, users can mix freeform text together with references to external data, and can author dynamic formulas for pulling in information like weather forecasts and routing information.

We find that Embark supports a wide variety of travel use cases ranging from short weekend trips to sprawling RV roadtrips, all within a single medium. More broadly, our work proposes an approach to unbundling apps into data, computations, and views which can be flexibly composed by users to meet their unique goals.

<!--endintro-->

## Introduction

Today’s software is organized into apps, each hosting its own walled-off digital realm. Whenever a complex task requires multiple apps, users are often forced to manually juggle information across apps, resulting in tedious and error-prone coordination work.

As an example, consider the variety of tasks involved in planning a trip: you might need to find lodging, book a flight, map out driving routes, jot down notes on things to do, look up weather forecasts, contact people to meet, and more. Apps can do a great job handling these individual tasks in isolation, but coordinating across them can be tedious and error-prone. Our computers struggle to help us with seemingly simple tasks like “compile a weather forecast for all the places I’m going on this trip” or “find directions to the hotel I’m staying at”. Key information like ticket and reservation numbers are scattered across calendars, emails, and hotel- or airline-specific apps. A single mistake in manually copying a date from an email to a flight booking can result in a very unpleasant surprise at the airport.

We believe these symptoms reflect a deeper problem: the limits of the abstractions and composition mechanisms available to users. Our modern computing platforms offer some limited composition mechanisms—people can copy-paste data between apps, manually combine information in spreadsheets, or simply place windows next to each other—but these techniques are too weak to handle complex workflows like planning travel.

In this work, we explore a new set of more powerful compositional abstractions, using travel planning as a testbed. How might we enable users to combine travel tools like maps, calendars, and other data sources in custom ways that let them efficiently plan and execute a wide variety of real-world trips?

Our general strategy is to unbundle apps into data, views, and computations, and let users combine these primitives flexibly in their own digital workspace. This idea raises a variety of new questions: How should users send data to computations? How should they connect the output of one computation to be used as the input of another? How does a user tell a view to display information from a variety of different places?

In this essay, we explore these questions through a prototype called **Embark**: a computational outliner where people can create rich interactive documents that handle the entire workflow of planing a trip, from early ideation to detailed planning. Embark provides the following primitives to users:

- Documents are represented as freeform outlines. Users can type text wherever they wish, and they can structure their documents as they see fit.
- Structured data can be embedded within the text as data tokens. Users can create data tokens through “@” mentions. They can refer to other nodes in the outline or pull in data from external data services like places from Google Maps.
- Formulas allow users to pull in live data like weather forecasts or perform computations like basic arithmetic. Formulas are also a kind of data token, but they generate their output dynamically based on their input parameters rather than always returning the same object.
- Interactive views can be opened inline or in separate panes to render any suitable data tokens within a subtree. For example, a map can be opened to show the locations and routes planned out in one branch of a document or for the document as a whole.

As a concrete example of these primitives at work, below is an Embark document for planning a weekend trip, which includes 1) a list of activities written in an outline, 2) data tokens (in blue text) representing places to visit, 3) weather forecasts and public transit routes queried with formulas, and 4) interactive map and calendar views. (We will explain this document in more depth below; for now we just present it to briefly showcase Embark’s capabilities.)

{{< figure src="static/Screenshot_2023-07-10_at_12.46.50.png" caption="Screenshot 2023-07-10 at 12.46.50.png" >}}

Embark’s flexible model and reusable tools have proven broadly useful in our own real-world travel. We have used it to plan multi-stop air travel for conferences, an open-ended road trip through Europe, and long-term RV voyaging. Each of these has substantially different requirements along many dimensions: modes of transport,  availability of high quality data about places on the route, and amounts of planning in advance.

{{< figure src="static/docs.png" caption="Snippets of Embark documents for planning various kinds of trips" >}}

Snippets of Embark documents for planning various kinds of trips

Here are a few of our key findings from using Embark.

**********************************************Outliner as semiformal data model:********************************************** The outliner as a data format strikes a nice balance between allowing for freeform expression of thoughts while also supporting some light structure. It also allows for taking notes on any part of a travel plan, including computational outputs like routing times. Placing views and computations inline among the text notes allows them to appear together with the surrounding context; this allows for useful patterns like recording comments and reasoning right next to the relevant information.

********************************************Concrete data inputs:******************************************** A key design tension is how much meaning to infer from the shape of the outline. On the one hand, it’s useful to allow the user to write data in any outline shape they prefer, without restricting them to specific rules. On the other hand, it’s useful for computations to be able to make inferences based on the shape of the outline; for example, if the user types a date and then inserts a weather forecast query underneath that date, perhaps the weather should automatically use the date? Still, this raises more questions: What about the location for the weather forecast—how far away should we look in the document for a location? If the date changes, should the forecast be updated automatically?

In Embark, computations always reference specific concrete data inputs—for example, a weather query has a certain location and date specified, and these arguments are simply values, rather than pointers to the surrounding documents. Then, to pull in relevant context when populating these arguments, we provide autocomplete suggestions which apply heuristics to interpret the outline structure—for example, suggesting that the user fill in a weather computation with a nearby date. However, once the date is filled in, it is resolved to a concrete value; this means that future edits to the outline will not have unexpected consequences in faraway parts of the document.

********************************************************************Computational results as objects:******************************************************************** In Embark, we separate two concepts usually entangled in conventional software applications: the domain model and the interface that presents it to the user. We can see this conflation, for example, in Google Maps. There is no concept of a route independently from the route planning screen; the currently shown route is ephemeral. This means things are very fragile: if a user wants to see more details for another point on the map, they might navigate away from the route screen, and suddenly the route is gone.
In Embark, a route is a persistent object that lives in the outline as a data token. It doesn’t disappear if we stop looking at it. Because it’s an object, we can handle it independently from an interface: we can create lists of routes, display multiple routes in a map view, or contextualize route information by adding other functions like the weather in the same information space.

In summary, Embark embodies a new set of primitives for composing software tools within an outliner document. Through various travel planning scenarios, we demonstrate that these primitives are simple yet powerful enough to prove useful with real tasks. More broadly, our work gestures towards a new kind of computing, where end-users can flexibly recompose tools outside of monolithic applications.

## Design Principles

There are many travel apps, each supporting various parts of specific workflows envisioned by their developers. But every trip is different, and anything that makes a trip more unique also makes it harder to plan with today’s software.

Take, for example, one of the needs for an RV trip: great attention to overhead clearances and weight restrictions. Even though this information affects route planning for millions of travelers, it’s too unique to be found in today’s mainstream consumer mapping apps. And apps which explicitly support routing with heights and weights in mind often lack other important features, such as live traffic updates or integration with in-car screens. RVers are then forced to use two apps, on two devices, at once: one for live traffic updates, and another to watch out for low bridges.

With apps’ pre-packaged, rigid interfaces, users piece together what they need from many apps. But with the weak composition mechanisms available, this work is far from optimal: copying and pasting key information like dates is tedious and error-prone, using side-by-side maps is cumbersome and distracting, and often the only source of needed data isn’t offered in an interface that supports a user’s context and needs.

We sought to provide a more powerful set of compositional primitives to users. Here are some of the design principles we considered:

- **************************************************Support non-programmers: A************************************************** smooth slope from usage to customization should be offered, which doesn’t require any programming knowledge to get started. (It may unavoidably require some programming if you get into very deep customization or composition.)
- **Give users agency:** The system’s responsibility is to give context. The user is always in charge of making the final decisions. The system shouldn’t automatically assume what the user’s intention is, but provide proper context and suggestions. For example, if the user books a flight on the wrong date, that’s a failure of the system to provide proper context.
- **Evaluating alternatives:** When choosing between different possible options—for dates, destinations, flights, hotels, or more—the system should let users easily consider multiple possible scenarios and compare across them. Users should be able to flexibly experiment with and back out of potential alternatives.
- **Nonvolatile workspaces:** Users should be able to save and return to the documents they’ve composed; instead of one ephemeral workspace (i.e., windows on a desktop), users should be able to create a nonvolatile workspace for each use, returning to them as needed.
- **********************************************************************Separation of data and views:********************************************************************** The provider of some data cannot tie that data to one interface; users should be able to use data how they wish, transforming it in new ways and loading it into other views as desired. Users should be able to see comparable data in the same view: hotels and Airbnbs can be combined into one list, Google Maps routes and bridge-height information could coexist on the same map, etc.
- **Triangulation / Non-linear decision making:** Many times in travel planning, decisions are best made non-linearly (for example, users might want to compare whether the airfare discount or the hotel discount — each on different dates — is better, in which case they can’t make one decision after the next). The system should support this triangulation process and not force users into a strictly linear workflow. When planning trips, users often work along a gradient between a space of possible solutions and a concrete plan. System primitives should support moving along this gradient continuously.

## Embark: an example scenario

To see how Embark is used in practice, let’s examine a real scenario that one of our authors Paul encountered: planning a weekend with some friends. His friends were visiting his hometown of Aachen for the first time so he wanted to plan some fun activities; in doing so he also had to consider the weather for each day of their trip and plan transportation like renting a car or finding public transit routes.

Usually, such a planning task would require writing down a plan somewhere and separately pulling together information from various apps like like Google Maps, a weather app, and a car-sharing app. However, in Embark, all of these tools live together in a shared medium where freeform notes can be mixed with structured data and formulas, so the entire planning task can be achieved in a single medium.

In this section we’ll walk through how Paul went about planning this weekend in Embark. As a preview of the final result, here is the document he will end up creating. It’s a daily agenda which includes a list of activities for each day with text notes on each one, a daily weather forecast, public transit routing information, as well as map and calendar views.

{{< figure src="static/Screenshot_2023-07-10_at_12.46.50%201.png" caption="Screenshot 2023-07-10 at 12.46.50.png" >}}

### Outliner as a base material

A few weeks before the visit, Paul wanted to jot down a few notes about the trip, like when his friends will arrive, and some ideas for activities that they could do together. In this initial planning stage, his ideas were preliminary and divergent: he was not thinking about specific days or times, or making firm decisions yet.

To support this early stage, Embark offers a very lightweight structure: a text outline. It also lets users embed entities like places or dates as data tokens. When Paul is creating a list of activities, he can simply write an outline as free form text and add locations with the “@” mention search.

{{< rawhtml >}}

<figure>
<video controls preload="auto" muted="" width="100%" src="static/Screen_Recording_2023-07-11_at_13_33_21_AdobeExpress.mp4">
</video>
<figcaption>
Caption TODO
</figcaption>
</figure>

{{< /rawhtml >}}

If we look inside one of these data tokens we can see that they are just linked outline nodes. The system automatically created a node for “Aachen Cathedral” when Paul autocompleted the location. Users can still edit these system-created nodes just like any other node. (System-created nodes do not have a location in the user’s document; they are only accessible by clicking on links.)


{{< rawhtml >}}

<figure>
<video controls preload="auto" muted="" width="100%" src="static/Screen_Recording_2023-07-11_at_13.38.04.mov">
</video>
<figcaption>
Caption TODO
</figcaption>
</figure>

{{< /rawhtml >}}


Notably, these data tokens helps the system understand the information in the outline without forcing the user to fit their thought process into a predefined structure.

### Viewing structured data

Paul wants to share the weekend plan with his friends, and he realizes it would be useful if they could see the places on a map to get a better feeling for the city.

In Embark, he can do this by simply selecting the root node of the outline and opening it in a map view. The map view reads in any location data tokens underneath the root node and displays them as markers on the map.

The user can work with the map view and the outline together because the markers on the map are linked back to the outline through a two-way hover interaction. For example, by looking at the map, Paul can see that most activities are within walking distance; only the chocolate factory and the art museum are further out.

{{< rawhtml >}}

<figure>
<video controls preload="auto" muted="" width="100%" src="static/Screen_Recording_2023-07-11_at_14.28.11.mov">
</video>
<figcaption>
Caption TODO
</figcaption>
</figure>

{{< /rawhtml >}}

Views can be displayed beside the document or embedded within the flow of the outline. It’s also possible to add separate views for sub-nodes in the outline. For example, if Paul wants to split the activities across multiple days, he could create a separate map for each day so his friends can quickly see where they need to go.

{{< figure src="static/Screenshot_2023-07-11_at_14.45.50.png" caption="A global map view of the whole plan" >}}

A global map view of the whole plan

{{< figure src="static/Screenshot_2023-07-11_at_14.47.07.png" caption="A separate map view for each day of the trip" >}}

A separate map view for each day of the trip

### Properties

Paul decides to customize the map display further by showing a church icon for the cathedral visit. He can do this by editing the outline of the “Aachen Cathedral” data token.

{{< rawhtml >}}

<figure>
<video controls preload="auto" muted="" width="100%" src="static/Screen_Recording_2023-07-11_at_14_51_33_AdobeExpress.mp4">
</video>
<figcaption>
Editing the map icon for a cathedral by adding a property in the outline
</figcaption>
</figure>

{{< /rawhtml >}}

Editing the map icon for a cathedral by adding a property in the outline

For defining properties, Embark piggybacks on a convention that people already use in non-computational outlines. Users can define a property by starting a bullet with the name of the property and a colon followed by a value. Generally, users are free to use whatever property names they like, but some properties have a special meaning, like the icon property in the example above, which is read by the map view to determine how a location should be rendered.

There are a couple of built-in schemas. For example, a bullet in the outline is treated as a location if it has a position property with a geo position value.Often structured objects like locations or dates are imported automatically through the “@” mention mechanism, so users don’t have to think about the underlying schemas.

### Using formulas

Once Paul has sketched out a rough plan, there are more details to consider.

He and his friends need to decide when to do each activity, considering the weather to avoid outdoor activities on rainy days. Then they need to sequence things and plan transportation—for example, is walking faster or should they take public transport?

If Paul were to plan his weekend using a traditional static document, he would have to use several apps to gather all the necessary information. He might visit a weather forecasting site to check for rainfall, but the site wouldn't automatically know the location relevant to Paul, forcing him to input this data manually. The process becomes even more laborious if he has to repeat this for multiple locations. After he finds the result, there is no option to integrate the weather data directly with the static outliner—his only options would be to manually copy the data or take a screenshot. And if the weather forecast changes, he would need to go through the entire process for each location all over again.

In Embark, formulas can be added directly to the outline. If Paul selects a node, Embark automatically suggests useful formulas using the data tokens near that position in the outline as arguments. For example, if he wants to know if it will rain on Friday, he can select the node for Friday in the outline, and a list of suggested formulas pops up in a sidebar. Embark automatically infers the location from the context of the outline. Clicking on the button inserts the formula into the outline and shows the resulting weather forecast:


{{< rawhtml >}}

<figure>
<video controls preload="auto" muted="" width="100%" src="static/Screen_Recording_2023-07-11_at_15.29.56.mov">
</video>
<figcaption>
Inserting a weather forecast for Friday into the outline
</figcaption>
</figure>

{{< /rawhtml >}}


Inserting a weather forecast for Friday into the outline

Because the suggested formulas show a preview of their results even before they are inserted into the outline, sometimes it’s enough to just skim the suggestions without actually adding them. For example, earlier Paul noticed that the chocolate factory is further away, so if he opens the formula suggestion on that node, he can quickly see that public transport is much quicker than walking there.


{{< rawhtml >}}

<figure>
<video controls preload="auto" muted="" width="100%" src="static/Screen_Recording_2023-07-11_at_15.30.58.mov">
</video>
<figcaption>
Caption TODO
</figcaption>
</figure>

{{< /rawhtml >}}


### Repeating formulas

Sometimes we want to apply a computation throughout the whole document. For example, getting the weather for all days would be useful. Paul could achieve this by manually adding weather formulas to all days in the outline, but Embark also offers an automated way. If he focuses on a formula, a repeat button appears, allowing him to apply the formula across the outline. When Paul hovers over the repeat button, he can see a preview of where the formula will be repeated, and then he can click it to apply the automation.


{{< rawhtml >}}

<figure>
<video controls preload="auto" muted="" width="100%" src="static/Screen_Recording_2023-07-11_at_15.37.37.mov">
</video>
<figcaption>
Caption TODO
</figcaption>
</figure>

{{< /rawhtml >}}

For the repeat button, Embark infers a pattern for the formula based on how its arguments relate to the outline. In this case the inferred pattern would look like this:

\`\`\`
- $Location
	- ...
	- $Date
		- {Weather(in: $Location, on: $Date)}
\`\`\`

After inferring this pattern, Embark tries to find other places in the outline that match this shape and insert a formula using the matched nodes as arguments to the function. The repeat button is a one-time action—the formulas it inserts don’t have any special behavior and can be edited just like a manually inserted formula. (We discuss the tradeoffs of this design later in our Findings.)

### Overlaying multiple data sources

Making good decisions depends on multiple factors. It’s helpful to have as much context as possible. This is difficult in today’s app-based world, where each bit of information lives in a separate space. This matters even for simple decisions.

For example, on Saturday, there are two points on the agenda, and the question is how to sequence them. Because we have all data in a shared space, it’s enough to view the Saturday node in a calendar view. The calendar pulls in all relevant data: the opening times of the flea market and the precipitation probability from the weather computation. Looking at the calendar, it’s obvious that Paul and his friends should go to the flea market first because it’s less likely to rain in the morning.


{{< rawhtml >}}

<figure>
<video controls preload="auto" muted="" width="100%" src="static/Screen_Recording_2023-07-11_at_16.03.30.mov">
</video>
<figcaption>
Caption TODO
</figcaption>
</figure>

{{< /rawhtml >}}


What seems obvious and simple in Embark is very hard to do in the conventional app model. For example, If you open Google Calendar and pull up the weather forecast in another tab, there is no way to combine these two data sources in a single view. In Embark, this is possible because the weather forecast and the time information live in the same data substrate. A structured view like the calendar view can read both pieces of information as time ranges.

### Custom computations

On Sunday, the plan is to go canoeing. This is a bit further away, so Paul must figure out how to get there. So far, we have been using the automatically suggested formula buttons, but there is also a way to add formulas by typing  “/” which pops open a list of suggested formulas. The suggestions can be filtered down with a fuzzy text search. For example by typing “from aachen to rurda” Paul can get a list of suggestions for different routing options between Aachen and Rur Dam. By looking at the list of modalities, we can see that the only viable option is to go there by car.


{{< rawhtml >}}

<figure>
<video controls preload="auto" muted="" width="100%" src="static/Screen_Recording_2023-07-11_at_16.13.07.mov">
</video>
<figcaption>
Caption TODO
</figcaption>
</figure>

{{< /rawhtml >}}


Paul doesn’t own a car but uses a car-sharing app. Before the trip, it would be good to know approximately how much it will cost. By assigning the route computation to a property, he can use the distance of the route to compute the price based on the cost per kilometer (30 Cents) and the fixed daily rate (25 Euros). Formulas behave just like object tokens; instead of assigning them to properties, they can also be mixed in line with free-form text.


{{< rawhtml >}}

<figure>
<video controls preload="auto" muted="" width="100%" src="static/Screen_Recording_2023-07-11_at_16_15_50_AdobeExpress.mp4">
</video>
<figcaption>
Caption TODO
</figcaption>
</figure>

{{< /rawhtml >}}


Now Paul has completed his plan for the weekend. All the results of his planning are easily accessible in a single document which he can continue to come back and reference as the weekend is underway. And any updates to external data (e.g., updates to the weather forecast) will automatically propagate into his document over time.

## Other use cases

To show the versatility of Embark, here are some other documents we made while planning real trips during the course of this project.

**************************************Planning RV travel:************************************** One of our authors Alexander was planning a new round of full-time travel by RV. Of interest during this long-term land travel isn't just the destinations, but the routes chosen to get there. Embark could host wishlists of both routes and points of interest, in a list with notes for needed context, and visualized on a map to help make planning clearer.

{{< figure src="static/Screenshot_2023-06-01_at_10.08.57_AM.png" caption="Screenshot 2023-06-01 at 10.08.57 AM.png" >}}

One of Alexander's legs of travel was particularly difficult: upcoming traffic around a holiday, less camping availability, excessive heat, incoming storms, and the need to hit a specific average miles traveled per day (not too high or low) all had to be taken into account. Embark was a perfect match for the challenge: mileages and weather for potential plans could be quickly gathered. Notes and links could be written to provide needed context.

{{< figure src="static/Screenshot_2023-06-27_at_1.56.22_PM.png" caption="Screenshot 2023-06-27 at 1.56.22 PM.png" >}}

**********************************************************************Deciding where to stop for dinner:********************************************************************** Another one of us, Geoffrey, was deciding between two restaurants for a dinner stop during a road trip. He was able to make an outline section called “Possible dinner stops” showing the two alternative routes, each with two segments: to the restaurant, and then onwards to the final destination. He chose the first option because the drive was more balanced across two legs, and because he saw from the map that he could take a coastal route.

[CleanShot 2023-07-11 at 23.33.54.mp4](static/CleanShot_2023-07-11_at_23.33.54.mp4)

************************************************Poles of Inconvenience:************************************************ One of us, Paul, has been using Embark to plan an [adventure trip](https://www.theadventurists.com/poles-of-inconvenience/) together with his brothers, called Poles of Inconvenience, where the goal is to visit a number of inconveniently located “poles” from a suggested list. He’s been able to create a color-coded map of the locations to explore the different poles.

One evening Paul was talking on the phone with his brothers to discuss which locations they should visit first. He pulled up a document he had previously put together which contained the locations of all the poles; then during the call he could quickly jot down different options for poles and compute routes between them. In this case Paul didn’t even bother to write a full outline. Embark just served as an ephemeral note to figure out if they could do 3 poles in one day, similarly to how you would use a scrap of paper to scribble on in order to work through a problem.

{{< figure src="static/Screenshot_2023-07-12_at_12.24.21.png" caption="Screenshot 2023-07-12 at 12.24.21.png" >}}

## Programming model

In this section we briefly describe the data model and programming model underlying Embark.

### Outline

The core data structure in Embark is a tree presented to the user as an outline. Users can freely mix free form text with structured bits of data. Structured data is embedded within the text as data tokens. Data tokens can be either references to other nodes or formulas that can compute dynamic values or query external systems.

An outline can be used to express many different structures: sequences, nested groupings, or alternatives. How to interpret the outline depends on the content, though; looking at the structure alone is not enough. Embark doesn’t try to distinguish between these different meanings; it only applies generic behaviors that depend on parent-child relationships. In general, if a node is nested as a child under a parent node, the the child node is considered part of the parent node.

### Properties

For creating structured objects, Embark has a name-value syntax. A node can be turned into a property by writing \`name: value\`. The value can be a literal like plain text, or a number or a data token like a node reference or a formula. There are two ways to access the value of a property:

First, we can get the value of a property by referring to the parent node and accessing the property by its name. If a node has multiple child properties with the same name the value of the first node will be returned. This is how data tokens like locations or dates are defined. They consist of a root node that defines the name of the object, the attributes of the objects are then defined as property nodes underneath it.

Properties can be also used to define values for a whole subtree. For example, when the user displays the outline on a map, the map view looks for a \`color\` property for each location. If a location doesn’t have a property, the map view searches upwards through the chain of ancestors until it finds a color attribute. For example, users can use this mechanism to assign different colors to individual sub trees in their document to color code activities on different days or different categories of locations. This follows the containment semantic of the outline. If a property is defined in the outline it applies to all contained nodes, unless it’s overridden by a more local property.

This mechanism is also used in Embark for managing settings. Some of the formulas like the route functions or the weather forecast support different units. It would be annoying if users manually had to specify the temperature unit whenever they want to use a weather function. Instead of requiring \`temperatureUnit\` as an explicit parameter, the weather function looks up \`temperatureUnit\` as a name in the outline. There is a special settings document that provides default values for all functions. The settings document is a fallback: when there is no property within a subtree, Embark uses the property from the settings document.

Users can also define their own names. For example, a user could define a home property in their settings document with their home address so they can easily refer to it from any document as “home”.

### Node references

Node references can be used to refer to nodes that are already part of the outline. Often, they are used to reference nodes that are provided by external data providers, like places from Google Maps.

When the user searches for nodes like a place in Google Maps, the data providers materializes outline nodes representing the search results. These nodes can be linked to from the outline, but they don’t currently have a parent node giving them a location within the document. (As future work, we have considered giving locations to these nodes from external services; they could for example be placed in a global document listing nodes from a given data provider.)

### Formulas

Formulas are a special kind of data token. For example, the map view is only concerned about displaying nodes in the tree that have a \`position\` property with a geo position value. The \`position\` property could be directly filled in within the outline, or it might come from a linked data token, or it might come from the result of a formula—the map view doesn’t distinguish between these cases.

Because formula tokens also produce outlines as a result, they can essentially be treated as outline nodes. The only limitation is that the result outline of a computation cannot be edited. (In our implementation we currently display formula results in a specialized JSON data view, but in the future we would like to change this to display results in a normal outline.)

The arguments to formulas are always explicitly specified, either as a relative reference that looks up a name in the hierarchy or as an absolute reference that links to a specific node. The benefit is that this allows users to place formulas anywhere in their outline and they don't have to follow a specific structure. (We reflect on the tradeoffs of this decision in Findings below.)

### Views

Interactive views can be used to visualize any data in the outline. The user can apply a view to any node (including the root node to visualize a whole document). They can also choose whether to show a view inline within the document, or in a separate pane next to the document.

The views interpret the node that they are visualizing as a set of the structured data tokens that are contained within it. Each view implicitly expects a certain schema that the data in the outline has to follow; for example, the map view looks for objects with a \`position\` property.

So far we have paid limited attention to handling of schemas; for example, we don’t surface the schema requirements of various views to the user in any way, although this is critical information for creating data that can be visualized by views. In practice this hasn’t been a problem so far because most structured objects come from external data services which always return the same schema (e.g., Google Maps objects always have a \`position\`). However, if we were to extend the system to have more data types and more views, we would need to handle schemas more explicitly and also consider transformations between datatypes.

## Findings

### Outline as semi-formal data model

In our initial prototypes of Embark, we tried building a more structured layout typical of GUI applications. However, we ultimately found a text outline to be the most useful data substrate for planning trips.

The outline strikes a nice balance between providing structure and allowing enough ambiguity to fluidly express your thought without feeling constrained. The parent-child hierarchy provides some minimal structure which enables many things in our model: grouping things, toggling things, enabling views for subtrees, referring to collections of items, and so on. These tasks would be more difficult in an even more freeform medium like plaintext or a spatial canvas.

 At the same time, the exact *meaning* of the outline hierarchy is left ambiguous: it can express containment, sequences, annotations, and more. The meaning is implied through the content. There is no fixed schema that you have to fit your thoughts into; You can start with a loose plan and gradually add more structure over time if desired.

This is a stark contrast to the formal data structure imposed by most apps. For example, in the screenshot below, consider the same plan from the example scenario, created in the trip-planning app Wanderlog. While the app offers many useful features, it also imposes strict data structure: a trip plan always has to consist of lists of locations, and free form text is only allowed in certain restricted places.

{{< figure src="static/Untitled.png" caption="Untitled" >}}

The loose structure of Embark documents can sometimes be challenging to deal with. When Embark tries to infer the meaning of the outline, it can never be sure what the user's intention was: Should a list of places be interpreted as sequential steps in a route or as a set of alternatives? This makes it hard to suggest useful computations or generalize patterns reliably.

Nonetheless, there are many valuable things the computer can do without understanding all the implicit relationships in the user's notes. This is helped by the fact that we have rich built-in structured data types for things like locations, dates, and functions. For example, if the user wants to see their travel plan on a map, it's enough for Embark to slurp up the location tokens in the notes without understanding how they are related. The nuances of the unstructured notes are preserved because the map view is linked with the outline through hover interactions. If the user hovers over a marker in the map, it gets highlighted in the outline and vice versa.

Another benefit of the outliner is that it's a very familiar format to leverage people's existing knowledge. At the beginning of the project, we played around with a 2D canvas as an alternative base material, but this format has less established patterns to structure things, so we would have needed to invent many novel mechanisms. We also explored plain text as a substrate in the previous Potluck project. In theory, plain text is more flexible than an outliner, but In practice, we found that the added structure of the outline didn't add much friction compared to plain text.

### It’s useful to be able to annotate anywhere

People want to write notes on things. In the physical world, you see this in how we use sticky notes, magnetic whiteboards, or the margins of a book or paper.

In the digital realm, our modern systems often leave this inclination unsupported. We find ourselves wanting to write in the margins of our digital things, but unable to. Sometimes, a notes field is supported on certain data types by certain apps (for example, you can often take notes on calendar events or contacts). More often, we’re left to use a separate app solely dedicated to note-taking, or, of course, pencil and paper. Even when an app supports note taking on our digital things, it’s hard to trust: how deeply buried is this note in this app? Will I be able to get back to it? Will it always be there? And when using a separate app that we do trust, composition is weak and prone to problems.

Embark redraws the boundaries of our digital things to make taking notes on and around them part of the basic computational medium. Instead of putting notes in a separate app, or as an attribute on certain types of things, the Embark medium is inverted: **computations and views are embedded in the user’s note-taking environment**. (It may be interesting to note that this inversion was the result of iterating on an observation: whenever passing around sample uses of the tool before the inversion, we often passed it along with notes that provided context, thoughts, and explanations.)

At first, when starting with a blank document, Embark resembles the dedicated note-taking apps that users are familiar with. Users can write stream-of-consciousness if they wish, bringing in computation and views as they go. Or, they can work primarily with functions and views, and add any notes next to or around their things as needed. Critically, these **notes flow together with the functions, views, and things (e.g. places) they add context to**.

Being able to freely write notes in the same medium that hosts needed computations and views gives an ever-present graceful fallback: **anything that needs to be recorded can at least be written in text**, even if a more ideal view or computation isn’t available. With much of today’s mainstream software, users must leave the tool for anything out-of-bounds. In Embark, users are first and foremost able to compose their thinking with notes.

### Having all the context for a project in one doc is surprisingly convenient

In app-centric computing, the information about a trip tends to get spread across multiple apps: random emails, airline apps, Google Maps, etc. Bringing all the info for a trip into a single easily referenced doc is useful for humans since we can more easily find what we need. But it turns out having the context in one place is also very useful when we’re using that information in computational ways!

In normal computing, when we open an app we need to go elsewhere find the input arguments we need. I open Google Maps, but then I need to go to the Airbnb app to remember the address of where I’m staying. In Embark, because we host all computational tools within a single substrate, we can just autocomplete arguments based on the shared context we’re in. I can type “Route from Home to Airbnb” and get good autosuggestions without needing to switch out of my current context. Notably this works even if autosuggest is mediocre; being able to pick the data from a dropdown or click on it in my doc is still better than hunting for it elsewhere.

We’ve been surprised by how useful this is in Embark. Multiple people who’ve seen demos have commented on how magical it feels, even though it’s such a simple interaction.

Having context for a trip in one place could also help power even better autosuggestions in the future. Eg, we could use AI models to interpret all the context in a doc and use that to suggest computations that you might want to run.

### Prefer concrete over abstract references

There’s a key tension in Embark. On the one hand: we want to **allow for abstract computations** which repeat behaviors over sets of data. Computers are good at for loops, this saves the user time and effort and errors. On the other hand: we want to **save the user from doing too much abstract reasoning**. The user shouldn’t need to write complicated  patterns that reason about huge classes of outline structures. We also don’t want the user to need to carefully put their outline in just the right shape for a computational pattern to match.

Spreadsheets address this tension with **concrete computations plus smart copy-paste**. Every cell refers to some specific set of inputs; you get abstraction with a convenient copy-paste tool for duplicating a computation in multiple places while fiddling with the inputs for each instance. But each instance is fundamentally concrete after the copy is done.

We take inspiration from this and do the same thing in Embark. **Every computation operates on some specific concrete arguments which you can see**, just like a spreadsheet formula operates on specific cells as inputs.

Filling in these concrete arguments every time can be tedious. To help out, we offer: 1) an **autosuggest** menu which guesses what formula you might want to insert at a particular point, 2) a **repeat** button which guesses how you might want to duplicate an existing computation. After autosuggest or repeat is done, every computation is specific and concrete.

The benefit of this design is that it is very concrete. If the automation messes up, the user can just fix the arguments to a concrete formula instead of adjusting an abstract pattern or adapting the outline to follow a pattern. This follows our principle that Embark should never force the user to structure their outline in a certain way.

There are also drawbacks to this approach. Because the formulas are concrete, the arguments are repeated for each formula which can be visually noisy. Another problem is that the arguments don’t update automatically; for example, if a user changes the date of a bullet in his trip plan, he has to update the corresponding date in all formulas below it manually.

This is a limitation of the current implementation, and Embark could handle this case in a more intelligent way. If we want to keep formulas concrete we could show the user a replace action similar that pops up if the user replaces a value that is referenced by formulas else where in the tree. This would be a one time action similarly to the repeat button.

We could also imagine another level of abstraction that allows users to apply the repeat button continously. If such a live pattern is active it would automatically insert and remove ephemeral computed nodes whenever the matches in the outline change . For advanced uses cases this could be an useful extension but staying concrete is a better default because it’s more predictable and easier to reason about.

### Reifying formula results as objects is helpful

Most software entangles the abstract functionality of the application with the interface that presents it to the user. For example, in Google Maps you can search for a route between two points but there is no way to lift the route from the interface and handle it independently from the interface. This makes even simple composition like comparing two routes feel very cumbersome. The only thing you can do is place two windows next to each other. Google maps could make the route screen more complicated and controls to see multiple routes together but that would only solve this specific problem. It would be much more desirable to have a generic mechanism so you could even compose computations across multiple different applications

Beneath the surface, Google Maps already has an abstract notion of a route in the form of a function. Functions are oftentimes considered an advanced concept that is too complicated to understand by regular users. But we don’t think that has to be the case. In the most simple case a function is just a way to refer to the result of a computation. Similarly how urls are used to refer to specific view states we can use functions to refer to computed values. The benefit of computed values is that there is a clearer way to compose them.

Even this limited understanding of a function is already surprisingly powerful. It allows user to collect computed values in their outline, annotate them with free form notes and compose the result of multiple computations by visualizing them in a shared view.

## Related work

TODO fill in

- reification
- haystack
- instrumental interaction

The ideas in this work relate closely to outliner products like Roam Research, Tana, and Logseq, which allow users to write information in outlines and install extensions that perform computations with that information. We believe a key difference is that extensions in these products are programmed using general-purpose JavaScript programming, whereas Embark proposes a far more opinionated programming model that is easier for end-users than general programming. However, this conclusion is still speculative, and more work is needed to validate this conclusion and study the relationship to existing outliners in more depth.

Embark also relates to live programming notebooks like Jupyter Notebooks. However, unlike Jupyter it has a greater focus on weaving in lightweight computations as a small part a document made up of primarily text. The outline data structure of Embark is also not found in most computational notebooks.

## Future work and open questions

In our prototype, the components that make up Embark (views, computations, suggestions, and so forth) are hard-coded. Conceptually, we imagine a system of this kind would be more extensible, allowing users to bring independently-developed third-party components.

We also think it would be interesting to explore ways users could define how data flows into views. Given an existing calendar view, for example, a user could modify exactly what data is shown within the calendar by filtering, grouping, etc., such as to choose exactly what kinds of weather events are presented. This could become a simple means by which users can adapt rich, interactive views to more closely support their needs.

Some early experiments showed that Embark may be a promising medium for AI and humans to collaborate within: since an Embark document has declarative specifications of views and computations, questions posed of AI could be answered to users with rich, interactive views, and locally-computed or fetched data. An LLM could also include notes to provide more context, and interpret the unstructured notes a user has written in their document so far when responding to requests.

## Conclusion

Embark shows one way to offer data, views, and computations as separate ingredients to users, allowing them to do things that they simply aren’t able to do with today’s “app” ecosystem.

It also shows the power of a semiformal data model like the outliner as the substrate for these components to live within. This was one of two interesting surprises in the course of developing Embark:

First, our explorations initially centered around more structured views which the user might bring together (a potentially more literal take on “how do we compose separate apps to work in tandem together”). But we noticed that we would always record (and share) notes that provided needed context for any composition in these tools, and when we inverted the environment to be notes-first, with computations embedded within, our prototype became much more independently capable.

Second, after this inversion, we were surprised by the real-world mileage we got out of Embark: despite having less of the power-user functionality we had initially envisioned, the prototypes described here consistently aided all of the authors in various real trips. Some for business, some for pleasure; some brief, some months-long; some by air, some by land. The basic primitives that we built into the system consistently provided a computational environment not otherwise available.

We hope that, in the future, personal software becomes more personal: users should be able to tailor their tools to their specific context and needs. Rather than pre-packaged apps which only explicitly support a small set of use cases, people should be able to co-mingle computational elements to support their needs, however specific, and use their data as they see fit.
`;
