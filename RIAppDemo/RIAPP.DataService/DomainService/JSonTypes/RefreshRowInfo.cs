using System.Runtime.Serialization;
using System.Web.Script.Serialization;

namespace RIAPP.DataService
{
    [DataContract]
    public class RefreshRowInfo
    {
        [DataMember]
        public string dbSetName
        {
            get;
            set;
        }

        [DataMember]
        public RowInfo rowInfo
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

        [ScriptIgnore]
        [IgnoreDataMember]
        public DbSetInfo dbSetInfo
        {
            get;
            set;
        }
    }
}
