using System;
using System.Collections.Generic;
using System.Collections;
using System.Linq;
using System.Text;
using System.Threading;

namespace RIAPP.DataService
{
    public class ShrededRequest
    {
        private int _fetchSize= 500;
        private QueryResult _res;
        private Queue<IEnumerable> _queue = new Queue<IEnumerable>();
        private int _chunkCount = 0;
        private Timer _releaseTimer;
        private Guid _id;
        private DateTime _lastAccess;

        public ShrededRequest(Guid id, QueryResult queryResult, int? fetchSize)
        {
            this._id = id;
            this._res = queryResult;
            if (fetchSize.HasValue) {
                this._fetchSize = fetchSize.Value;
            }
            int offset = -1;
            object[] chunk = null;
            foreach (var item in queryResult.Result) {
                ++offset;
                if (offset == this._fetchSize)
                {
                    offset = 0;
                    this._queue.Enqueue(chunk);
                    chunk = null;
                    this._chunkCount += 1;
                }
                if (chunk == null)
                {
                    chunk = new object[this._fetchSize];
                }
                chunk[offset] = item;
            }

            if (chunk != null) {
                object[] chunk2 = new object[offset+1];
                Array.Copy(chunk, chunk2, offset + 1);
                this._queue.Enqueue(chunk2);
                this._chunkCount += 1;
            }
            this._res.Result = null;
            this._res.ChunksID = this._id.ToString();
            this._releaseTimer = new Timer(ShrededRequest.OnReleaseTimer, this, Timeout.Infinite, Timeout.Infinite);
            this._lastAccess = DateTime.Now;
        }

        private static void OnReleaseTimer(object state){
            ShrededRequest self = (ShrededRequest)state;
            if (self.ReleaseRequestAction != null)
            {
                Action<ShrededRequest> action = self.ReleaseRequestAction;
                self.ReleaseRequestAction = null;
                action(self);
            }
        }

        internal void StopTimer()
        {
            if (this._releaseTimer != null)
            {
                this._releaseTimer.Change(Timeout.Infinite, Timeout.Infinite);
            }
        }

        internal void StartTimer()
        {
            if (this._releaseTimer != null)
            {
                this._releaseTimer.Change(ShrededRequestManager.MAX_CHUNK_LIFETIME, Timeout.Infinite);
            }
        }

        internal QueryResult CurrentResult
        {
            get
            {
                if (this._chunkCount <= 0)
                {
                    this._res.Result = new object[0];
                }
                else
                {
                    this._chunkCount -= 1;
                    this._res.Result = this._queue.Dequeue();
                }
                this._lastAccess = DateTime.Now;
                return this._res;
            }
        }

        public int ChunkCount
        {
            get
            {
                return this._chunkCount;
            }
        }

        public Guid id
        {
            get
            {
                return this._id;
            }
        }

        public DateTime LastAccessTime
        {
            get
            {
                return this._lastAccess;
            }
        }

        internal Action<ShrededRequest> ReleaseRequestAction
        {
            get;
            set;
        }
    }
}
