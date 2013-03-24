using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Collections.Concurrent;
using System.Threading;

namespace RIAPP.DataService
{
    public class ShrededRequestManager : IShrededRequestManager
    {
        private ConcurrentDictionary<Guid, ShrededRequest> _requests;
        public const int MAX_CHUNK_LIFETIME = 6000;

        public ShrededRequestManager()
        {
            this._requests = new ConcurrentDictionary<Guid, ShrededRequest>();
        }

        /// <summary>
        /// Backup cleaning Mechanism
        /// </summary>
        private void CleanUp()
        {
            if (this._requests.IsEmpty)
                return;
            var keys = this._requests.Keys.ToArray();
            foreach (var key in keys)
            {
                ShrededRequest req2 = null;
                if (this._requests.TryGetValue(key, out req2))
                {
                    if ((DateTime.Now - req2.LastAccessTime).TotalMilliseconds > MAX_CHUNK_LIFETIME) 
                    {
                        this.req_ReleaseRequest(req2);
                    }
                }
            }
          
        }

        public QueryResult GetNextChunk(Guid id)
        {
            ShrededRequest req = null;
            if (!this._requests.TryGetValue(id, out req))
                return null;
            req.StopTimer();
            var res = req.CurrentResult;
            if (res == null || req.ChunkCount <= 0)
            {
                this._requests.TryRemove(id, out req);
            }
            else
                req.StartTimer();

            if (res != null)
                res.ChunksLeft = req.ChunkCount;
            //try additional cleanup, just to be sure
            this.CleanUp();
            return res;
        }

        public QueryResult AddQueryResult(QueryResult queryResult, int? fetchSize)
        {
            //first try additional cleanup, just to be sure
            this.CleanUp();
            Guid id = Guid.NewGuid();
            ShrededRequest req = new ShrededRequest(id, queryResult, fetchSize);
            if (req.ChunkCount > 1 && this._requests.TryAdd(req.id, req))
            {
                req.ReleaseRequestAction = new Action<ShrededRequest>(req_ReleaseRequest);
                req.StartTimer();
            }
            var currRes= req.CurrentResult;
            if (currRes != null)
            {
                currRes.ChunksLeft = req.ChunkCount;
            }
            return currRes;
        }

        void req_ReleaseRequest(ShrededRequest  req)
        {
            ShrededRequest req2 = null;
            if (this._requests.TryRemove(req.id, out req2))
            {
                req2.StopTimer();
            }
        }

        #region IDisposable Members

        void IDisposable.Dispose()
        {
            var keys = this._requests.Keys.ToArray();
            foreach (var key in keys)
            {
                ShrededRequest req2 = null;
                if (this._requests.TryRemove(key, out req2)) {
                    req2.StopTimer();
                }

            }
        }

        #endregion
    }
}
