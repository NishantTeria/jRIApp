jRIApp
======

<b>RIA application framework for building LOB applications</b>
<br/>
You can watch video of the demo on <a href="http://youtu.be/CxWcC2O8u-k" target="_blank">YouTube Main</a> and
<a href="http://youtu.be/m2lxFWhJghA" target="_blank">YouTube SPA</a>
<br/>
<p style="color:blue">the current version of the framework is updated to 1.2.6.5, see CHANGES.txt for details.</p>
<b>
This framework have been ported ported to typescript. You can go to <a href="https://github.com/BBGONE/jRIAppTS" target="_blank">jRIAppTS framework</a>
to have the typescript's version and updated demo. Now i will update only typescript's version, this one is for history.
</b>
<br/>
jRIApp – is application framework for developing rich internet applications - RIA’s. 
It consists of two parts – the client and the server parts. 
The client part was written in javascript language. 
The server part was written in C#  and the demo application was implemented in ASP.NET MVC 4.
The Server part resembles Microsoft WCF RIA services, featuring data services which is consumed by the clients. 
The Client part resembles  Microsoft silverlight client development, only it is based on HTML (not XAML), and uses javascript for coding.
The framework was designed primarily for building data centric Line of business (LOB) applications which will work natively in browsers without the need for plugins .
The framework supports wide range of essential features for creating LOB applications, such as, declarative use of data bindings,
integration with the server side service, data templates, client and server side data validation,
localization, authorization, and a set of GUI controls, like the datagrid, the stackpanel and a lot of  utility code.
Unlike many other existing frameworks, which use MVC design pattern, the framework uses Model View View Model (MVVM) 
design pattern for creating applications. 
The use of data bindings and view models resembles Microsoft silverlight data bindings style used in the XAML.

The framework was designed for getting  maximum convenience and performance, and for this sake it works in browsers which support ECMA Script 5.1 
level of javascript and has features like native property setters and getters, and a new object creation style with Object.create method.
The supported browsers are Internet Explorer 9 and above, Mozilla Firefox 4+, Google Chrome 13+, and Opera 11.6+. 
Because the framework is primarily designed for developing LOB’s applications, the exclusion of antique browsers does not harm the purpose,
 and improves framework’s performance and ease of use.

The framework is distinguished from other frameworks available on the market by its 
full implementation of the features required for building real world  LOB applications.
It has implemeted server side component - the data service. It has GUI controls that are aware of the events raised by data centric objects
like the DbSet and the Entity. 

For the creation of data centric applications the framework has GUI controls for working with the server originated data, with editing support, 
and submitting changes to the server with the data passing through data validation and authorization stages of data processing,
returning autogenerating field values - such as primary keys, timestamp values. 
The framework includes the ability to track changes (auditing) and do the error logging.

<b>
This framework is sufficiently tested (<i>i started it 2012-01-05</i>) on real world LOB applications. 
I developed it for myself and use it for LOB applications development at my work (an insurance company), and it replaces Silverlight with WCF RIA services 100%.
I decided to share it with the community because i often use free frameworks and plugins, and i'm not greedy:). 
I don't know any other javascript framework on the market with the capabilities of this framework for building the LOB applications (and there are many of them). 
I could not find a framework for the purpose with so many requirements as for building the real world LOB applications, 
so i chose to create it myself. 
And one more thing, i liked silverlight, with its superb databinding capabilities, so i mimicked them as much as i could in the framework.
</b>

--
Maxim V. Tsapov<br/>
Moscow, Russian Federation<br/> 
<a href="https://plus.google.com/u/0/102838307743207067758/about?tab=wX" target="_blank">I'm on Google+</a>