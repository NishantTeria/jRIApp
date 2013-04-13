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
        private const string CHUNKS_SEPARATOR = "$&@";

        private class ChunkResult
        {
            private int _chunkSize = 500;
            private Queue<IEnumerable<Row>> _queue = new Queue<IEnumerable<Row>>();
            private int _chunkCount = 0;

            public ChunkResult(GetDataResult queryResult, int? chunkSize)
            {
                var res = queryResult;
                if (chunkSize.HasValue)
                {
                    this._chunkSize = chunkSize.Value;
                }
                int offset = -1;
                Row[] chunk = null;
                foreach (var item in queryResult.rows)
                {
                    ++offset;
                    if (offset == this._chunkSize)
                    {
                        offset = 0;
                        this._queue.Enqueue(chunk);
                        chunk = null;
                        this._chunkCount += 1;
                    }
                    if (chunk == null)
                    {
                        chunk = new Row[this._chunkSize];
                    }
                    chunk[offset] = item;
                }

                if (chunk != null)
                {
                    Row[] chunk2 = new Row[offset + 1];
                    Array.Copy(chunk, chunk2, offset + 1);
                    this._queue.Enqueue(chunk2);
                    this._chunkCount += 1;
                }
            }


            internal IEnumerable<Row> CurrentChunk
            {
                get
                {
                    if (this._chunkCount <= 0)
                    {
                        return new Row[0];
                    }
                    else
                    {
                        this._chunkCount -= 1;
                        return this._queue.Dequeue();
                    }
                }
            }

            public int ChunkCount
            {
                get
                {
                    return this._chunkCount;
                }
            }

        }

        public IncrementalResult(GetDataResult res) {
            this.Data = res;
        }

        public GetDataResult Data { get; set; }

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
                response.Flush();
                return;
            }
            var chunkResult = new ChunkResult(this.Data, this.Data.fetchSize > 0 ? (int?)this.Data.fetchSize : (int?)null);

            if (chunkResult.ChunkCount <= 0)
            {
                writer.Write(serializer.Serialize(this.Data));
                writer.Flush();
                response.Flush();
                return;
            }

            int i = 0;
            while (chunkResult.ChunkCount > 0)
            {
                string res = null;
                if (i == 0)
                {
                    this.Data.rows = chunkResult.CurrentChunk;
                    res = serializer.Serialize(this.Data);
                    writer.Write(res);
                }
                else
                {
                    res = serializer.Serialize(chunkResult.CurrentChunk);
                    writer.Write(CHUNKS_SEPARATOR);
                    writer.Write(res);
                }
                writer.Flush();
                response.Flush();
                ++i;
            }
        }
    }
}
