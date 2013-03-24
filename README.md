jRIApp
======

<b>RIA application framework for building LOB applications</b>


jRIApp – is application framework for developing rich internet applications - RIA’s. 
It consists of two parts – the client and the server parts. 
The client part was written in javascript language. 
The server part was written in C#  and demo application was implemented in ASP.NET MVC (but it can be also written in other languages, for example Ruby or Java). 
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
This framework is sufficiently tested (more than a year) on real world LOB applications. I developed it for myself and decided to share it with the
community. I don't know any other frameworks on the market  with the capabilities of this framework. The three which
i'm aware of are the KnockOut.js, the Breeze.je, and  the Upshot.js. But they all don't fullfill the purpose of developing the LOB
applications. The only one which can be used for this purpose and works in browsers is Microsoft Silverlight with WCF RIA services,
but it is not based on javascript and needs plugin.
</b>

You are welcome to use it in yours applications.

--
Maxim V. Tsapov
Moscow, Russian Federation 