using System.Runtime.Serialization;
using System.Collections.Generic;

namespace RIAPP.DataService
{
    [DataContract]
    public class DbSet
    {
        public DbSet()
        {
            this.rows = new List<RowInfo>();
        }

        [DataMember]
        public string dbSetName
        {
            get;
            set;
        }

        [DataMember]
        public List<RowInfo> rows
        {
            get;
            set;
        }

    }

    [DataContract]
    public class ChangeSet
    {
        public ChangeSet()
        {
            this.dbSets = new List<DbSet>();
            this.trackAssocs = new List<TrackAssoc>();
        }

        [DataMember]
        public List<DbSet> dbSets
        {
            get;
            set;
        }

        [DataMember]
        public ErrorInfo error
        {
            get;
            set;
        }

        [DataMember]
        public List<TrackAssoc> trackAssocs
        {
            get;
            set;
        }
    }
}
