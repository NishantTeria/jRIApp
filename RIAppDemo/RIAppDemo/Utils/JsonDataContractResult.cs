using System;
using System.Collections.Generic;
using System.Linq;
using System.Web;
using System.Web.Mvc;
using RIAPP.DataService;

namespace RIAppDemo.Utils
{
    public class JsonDataContractActionResult : ActionResult
    {
        public JsonDataContractActionResult(Object data)
        {
            this.Data = data;
        }

        public Object Data { get; private set; }

        public override void ExecuteResult(ControllerContext context)
        {
            String output = SerializationHelper.Serialize(this.Data, this.Data.GetType());
            context.HttpContext.Response.ContentType = "application/json";
            context.HttpContext.Response.Write(output);
        }
    }
}