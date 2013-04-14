using System;
using System.Collections;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Web.Mvc;
using RIAPP.DataService;
using System.Web;

namespace RIAPP.DataService.Mvc
{

    public class IncrementalResult : ActionResult
    {
        private const string SEPARATOR = "$&@";

        public IncrementalResult(GetDataResult res) {
            this.Data = res;
        }

        public GetDataResult Data { get; set; }

        private string RowToJSON(Row row) { 
            StringBuilder sb = new StringBuilder();
            sb.Append("{");
            sb.AppendFormat(@"""key"":""{0}"",""values"":[", row.key);
            int i = 0;
            Array.ForEach<string>(row.values,(s)=>{
                if (i > 0)
                    sb.Append(",");
                if (s == null)
                {
                    sb.Append("null");
                }
                else
                {
                    string v = System.Web.HttpUtility.JavaScriptStringEncode(s);
                    sb.Append(@"""");
                    sb.Append(v);
                    sb.Append(@"""");
                }
                i += 1;
            });
            sb.Append("]}");
            return sb.ToString();
        }

        public override void ExecuteResult(ControllerContext context)
        {
            var response = context.HttpContext.Response;
            response.Clear();
            response.ContentType = System.Net.Mime.MediaTypeNames.Text.Plain;
            response.Buffer = true;
            response.BufferOutput = true;
            response.Cache.SetCacheability(HttpCacheability.NoCache);
            //context.HttpContext.Response.IsClientConnected
            var writer = context.HttpContext.Response.Output;
            System.Web.Script.Serialization.JavaScriptSerializer serializer = new System.Web.Script.Serialization.JavaScriptSerializer();
            if (this.Data.error != null || this.Data.rows == null)
            {
                writer.Write(serializer.Serialize(this.Data));
                writer.Flush();
                response.End();
                return;
            }

            var allRows = this.Data.rows;
            this.Data.rows = new Row[0];
            writer.Write(serializer.Serialize(this.Data));
            writer.Write(SEPARATOR);
            writer.Write("[");
            int fetchSize = this.Data.fetchSize==0 ? 500: this.Data.fetchSize;
            int i = 0;
            foreach (var row in allRows)
            {
                if (i > 0) { writer.Write(","); }
                writer.Write(this.RowToJSON(row));
                i += 1;
                if ((i % fetchSize) == 0){
                    writer.Flush();
                    response.Flush();
                }
            }
            writer.Write("]");
            writer.Flush();
            response.End();
        }
    }
}
