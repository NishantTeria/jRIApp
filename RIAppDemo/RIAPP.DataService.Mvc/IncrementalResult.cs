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
        private StringBuilder _rowStringBuilder;

        public IncrementalResult(GetDataResult res) {
            this.Data = res;
        }

        public GetDataResult Data { get; set; }

        private string RowToJSON(Row row) {
            if (this._rowStringBuilder == null)
            {
                this._rowStringBuilder = new StringBuilder(512);
            }
            StringBuilder sb = this._rowStringBuilder;
            sb.Length = 0;
            sb.Append("{");
            sb.AppendFormat(@"""key"":""{0}"",""values"":[", System.Web.HttpUtility.JavaScriptStringEncode(row.key));
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
            if (this.Data.error != null)
            {
                writer.Write(serializer.Serialize(this.Data));
                writer.Flush();
                response.End();
                return;
            }
            //Write rows in the stream separately - starting from included rows
            Queue<IEnumerable<Row>> rowsQueue = new Queue<IEnumerable<Row>>();

            if (this.Data.included != null)
            {
                foreach (IncludedResult subResult in this.Data.included)
                {
                    if (subResult.rowCount > 0)
                    {
                        //System.Diagnostics.Debug.Assert(subResult.rowCount == subResult.rows.Count());
                        rowsQueue.Enqueue(subResult.rows);
                        subResult.rows = null; //set rows to null
                    }
                }
            }

            //main rows in the end of the queue
            if (this.Data.rowCount > 0)
            {
                //System.Diagnostics.Debug.Assert(this.Data.rowCount == this.Data.rows.Count());
                rowsQueue.Enqueue(this.Data.rows);
                this.Data.rows = null;
            }

            writer.Write(serializer.Serialize(this.Data));
            writer.Write(SEPARATOR);
            writer.Write("["); //start array

            //default is to flush only when all rows is written to the stream
            int fetchSize = this.Data.fetchSize<=0 ? int.MaxValue: this.Data.fetchSize;
            int i = 0;

            foreach(IEnumerable<Row> rows in rowsQueue)
            {
                foreach (var row in rows)
                {
                    if (i > 0) { writer.Write(","); }
                    writer.Write(this.RowToJSON(row));
                    i += 1;
                    if ((i % fetchSize) == 0)
                    {
                        writer.Flush();
                        response.Flush();
                    }
                }
            }
           
            writer.Write("]"); //end array
            writer.Flush();
            response.End();
        }
    }
}
